
-- =========================================================
-- Phase 1 (retry): Unified transactions
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.contact_kind AS ENUM ('individual','spouse','relative','friend','employee','client','supplier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS kind public.contact_kind NOT NULL DEFAULT 'individual';

DO $$ BEGIN
  CREATE TYPE public.txn_type AS ENUM ('expense','income','transfer','debt','investment','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.txn_direction AS ENUM ('in','out','neutral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.txn_type NOT NULL,
  direction public.txn_direction NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  happened_at date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  counterparty_account_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  person_name text,
  category_id uuid,
  category_kind text,
  transfer_group_id uuid,
  source_kind text NOT NULL,
  source_id uuid NOT NULL,
  description text,
  notes text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  affects_balance boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: owner all" ON public.transactions;
CREATE POLICY "transactions: owner all" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tx_user_date ON public.transactions(user_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_account ON public.transactions(account_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_person ON public.transactions(person_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_type ON public.transactions(user_id, type, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category ON public.transactions(category_id);

DROP TRIGGER IF EXISTS tg_transactions_updated_at ON public.transactions;
CREATE TRIGGER tg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Scalar helpers (avoid set-returning in CASE)
CREATE OR REPLACE FUNCTION public._wallet_kind_type(_kind text)
RETURNS public.txn_type LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _kind IN ('transfer_in','transfer_out') THEN 'transfer'::public.txn_type
    WHEN _kind = 'adjustment' THEN 'adjustment'::public.txn_type
    WHEN _kind IN ('deposit','receive') THEN 'income'::public.txn_type
    WHEN _kind IN ('withdraw','send') THEN 'expense'::public.txn_type
    ELSE 'adjustment'::public.txn_type
  END;
$$;

CREATE OR REPLACE FUNCTION public._wallet_kind_dir(_kind text)
RETURNS public.txn_direction LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _kind IN ('deposit','receive','transfer_in') THEN 'in'::public.txn_direction
    WHEN _kind IN ('withdraw','send','transfer_out') THEN 'out'::public.txn_direction
    ELSE 'neutral'::public.txn_direction
  END;
$$;

-- =========================================================
-- Sync triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public._sync_tx_from_wallet_tx()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_type public.txn_type; v_dir public.txn_direction;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_kind='wallet_transactions' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  v_type := public._wallet_kind_type(NEW.kind);
  v_dir  := public._wallet_kind_dir(NEW.kind);
  INSERT INTO public.transactions (
    user_id, type, direction, amount, currency, happened_at,
    account_id, counterparty_account_id, transfer_group_id,
    category_id, category_kind, description, notes,
    source_kind, source_id, affects_balance
  ) VALUES (
    NEW.user_id, v_type, v_dir, NEW.amount, NEW.currency, NEW.happened_at,
    NEW.wallet_id, NEW.counterparty_wallet_id, NEW.transfer_group_id,
    NEW.category_id,
    CASE WHEN v_dir='in' THEN 'inflow' WHEN v_dir='out' THEN 'outflow' END,
    NEW.notes, NEW.notes,
    'wallet_transactions', NEW.id, true
  )
  ON CONFLICT (source_kind, source_id) DO UPDATE SET
    type = EXCLUDED.type, direction = EXCLUDED.direction,
    amount = EXCLUDED.amount, currency = EXCLUDED.currency,
    happened_at = EXCLUDED.happened_at,
    account_id = EXCLUDED.account_id,
    counterparty_account_id = EXCLUDED.counterparty_account_id,
    transfer_group_id = EXCLUDED.transfer_group_id,
    category_id = EXCLUDED.category_id,
    description = EXCLUDED.description, notes = EXCLUDED.notes,
    updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_sync_tx_wallet_tx ON public.wallet_transactions;
CREATE TRIGGER tg_sync_tx_wallet_tx
  AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public._sync_tx_from_wallet_tx();

CREATE OR REPLACE FUNCTION public._sync_tx_from_expense()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_kind='expenses' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.transactions (
    user_id, type, direction, amount, currency, happened_at,
    account_id, category_id, category_kind, description, notes,
    source_kind, source_id, affects_balance
  ) VALUES (
    NEW.user_id, 'expense', 'out', NEW.amount, NEW.currency, NEW.spent_at,
    NEW.wallet_id, NEW.category_id, 'outflow', NEW.note, NEW.note,
    'expenses', NEW.id, (NEW.wallet_id IS NULL)
  )
  ON CONFLICT (source_kind, source_id) DO UPDATE SET
    amount = EXCLUDED.amount, currency = EXCLUDED.currency,
    happened_at = EXCLUDED.happened_at, account_id = EXCLUDED.account_id,
    category_id = EXCLUDED.category_id, description = EXCLUDED.description,
    notes = EXCLUDED.notes, affects_balance = EXCLUDED.affects_balance,
    updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_sync_tx_expense ON public.expenses;
CREATE TRIGGER tg_sync_tx_expense
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public._sync_tx_from_expense();

CREATE OR REPLACE FUNCTION public._sync_tx_from_person_ledger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_dir public.txn_direction;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_kind='person_ledger' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  v_dir := CASE
    WHEN NEW.kind IN ('lend','pay') THEN 'out'::public.txn_direction
    WHEN NEW.kind IN ('borrow','collect') THEN 'in'::public.txn_direction
    ELSE 'neutral'::public.txn_direction END;
  INSERT INTO public.transactions (
    user_id, type, direction, amount, currency, happened_at,
    account_id, person_id, person_name, description, notes,
    source_kind, source_id, affects_balance, meta
  ) VALUES (
    NEW.user_id, 'debt', v_dir, NEW.amount, NEW.currency, NEW.happened_at,
    NEW.wallet_id, NEW.contact_id, NEW.contact_name, NEW.notes, NEW.notes,
    'person_ledger', NEW.id, (NEW.wallet_id IS NULL),
    jsonb_build_object('ledger_kind', NEW.kind, 'due_date', NEW.due_date, 'status', NEW.status)
  )
  ON CONFLICT (source_kind, source_id) DO UPDATE SET
    direction = EXCLUDED.direction, amount = EXCLUDED.amount,
    currency = EXCLUDED.currency, happened_at = EXCLUDED.happened_at,
    account_id = EXCLUDED.account_id, person_id = EXCLUDED.person_id,
    person_name = EXCLUDED.person_name, description = EXCLUDED.description,
    notes = EXCLUDED.notes, affects_balance = EXCLUDED.affects_balance,
    meta = EXCLUDED.meta, updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_sync_tx_person_ledger ON public.person_ledger;
CREATE TRIGGER tg_sync_tx_person_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.person_ledger
  FOR EACH ROW EXECUTE FUNCTION public._sync_tx_from_person_ledger();

CREATE OR REPLACE FUNCTION public._sync_tx_from_investment_tx()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_dir public.txn_direction;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_kind='investment_transactions' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  v_dir := CASE
    WHEN NEW.kind IN ('return','withdraw','capital_withdraw') THEN 'in'::public.txn_direction
    WHEN NEW.kind IN ('capital_add','principal','contribute') THEN 'out'::public.txn_direction
    ELSE 'neutral'::public.txn_direction END;
  INSERT INTO public.transactions (
    user_id, type, direction, amount, currency, happened_at,
    account_id, description, notes, source_kind, source_id, affects_balance, meta
  ) VALUES (
    NEW.user_id, 'investment', v_dir, NEW.amount, NEW.currency, NEW.happened_at,
    NEW.wallet_id, NEW.notes, NEW.notes,
    'investment_transactions', NEW.id, (NEW.wallet_id IS NULL),
    jsonb_build_object('investment_id', NEW.investment_id, 'inv_kind', NEW.kind)
  )
  ON CONFLICT (source_kind, source_id) DO UPDATE SET
    direction = EXCLUDED.direction, amount = EXCLUDED.amount,
    happened_at = EXCLUDED.happened_at, account_id = EXCLUDED.account_id,
    notes = EXCLUDED.notes, meta = EXCLUDED.meta, updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_sync_tx_investment_tx ON public.investment_transactions;
CREATE TRIGGER tg_sync_tx_investment_tx
  AFTER INSERT OR UPDATE OR DELETE ON public.investment_transactions
  FOR EACH ROW EXECUTE FUNCTION public._sync_tx_from_investment_tx();

-- =========================================================
-- Backfill
-- =========================================================
INSERT INTO public.transactions (
  user_id, type, direction, amount, currency, happened_at,
  account_id, counterparty_account_id, transfer_group_id,
  category_id, category_kind, description, notes,
  source_kind, source_id, affects_balance
)
SELECT
  wt.user_id,
  public._wallet_kind_type(wt.kind),
  public._wallet_kind_dir(wt.kind),
  wt.amount, wt.currency, wt.happened_at,
  wt.wallet_id, wt.counterparty_wallet_id, wt.transfer_group_id,
  wt.category_id,
  CASE WHEN public._wallet_kind_dir(wt.kind)='in' THEN 'inflow'
       WHEN public._wallet_kind_dir(wt.kind)='out' THEN 'outflow' END,
  wt.notes, wt.notes,
  'wallet_transactions', wt.id, true
FROM public.wallet_transactions wt
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (
  user_id, type, direction, amount, currency, happened_at,
  account_id, category_id, category_kind, description, notes,
  source_kind, source_id, affects_balance
)
SELECT e.user_id, 'expense', 'out', e.amount, e.currency, e.spent_at,
       e.wallet_id, e.category_id, 'outflow', e.note, e.note,
       'expenses', e.id, (e.wallet_id IS NULL)
FROM public.expenses e
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (
  user_id, type, direction, amount, currency, happened_at,
  account_id, person_id, person_name, description, notes,
  source_kind, source_id, affects_balance, meta
)
SELECT pl.user_id, 'debt',
  CASE WHEN pl.kind IN ('lend','pay') THEN 'out'::public.txn_direction
       WHEN pl.kind IN ('borrow','collect') THEN 'in'::public.txn_direction
       ELSE 'neutral'::public.txn_direction END,
  pl.amount, pl.currency, pl.happened_at,
  pl.wallet_id, pl.contact_id, pl.contact_name, pl.notes, pl.notes,
  'person_ledger', pl.id, (pl.wallet_id IS NULL),
  jsonb_build_object('ledger_kind', pl.kind, 'due_date', pl.due_date, 'status', pl.status)
FROM public.person_ledger pl
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (
  user_id, type, direction, amount, currency, happened_at,
  account_id, description, notes, source_kind, source_id, affects_balance, meta
)
SELECT it.user_id, 'investment',
  CASE WHEN it.kind IN ('return','withdraw','capital_withdraw') THEN 'in'::public.txn_direction
       WHEN it.kind IN ('capital_add','principal','contribute') THEN 'out'::public.txn_direction
       ELSE 'neutral'::public.txn_direction END,
  it.amount, it.currency, it.happened_at,
  it.wallet_id, it.notes, it.notes,
  'investment_transactions', it.id, (it.wallet_id IS NULL),
  jsonb_build_object('investment_id', it.investment_id, 'inv_kind', it.kind)
FROM public.investment_transactions it
ON CONFLICT DO NOTHING;

-- =========================================================
-- View: account statement with running balance
-- =========================================================
DROP VIEW IF EXISTS public.v_account_statement;
CREATE VIEW public.v_account_statement
WITH (security_invoker = true) AS
SELECT
  t.id, t.user_id, t.account_id, t.happened_at, t.created_at,
  t.type, t.direction, t.amount, t.currency,
  t.description, t.person_name, t.category_id, t.source_kind,
  CASE WHEN t.direction='in' THEN t.amount
       WHEN t.direction='out' THEN -t.amount
       ELSE 0 END AS signed_amount,
  SUM(
    CASE WHEN t.direction='in' THEN t.amount
         WHEN t.direction='out' THEN -t.amount
         ELSE 0 END
  ) OVER (
    PARTITION BY t.account_id
    ORDER BY t.happened_at, t.created_at, t.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_balance
FROM public.transactions t
WHERE t.affects_balance = true AND t.account_id IS NOT NULL;

GRANT SELECT ON public.v_account_statement TO authenticated;
