-- Schema parity for database changes that existed in production but were
-- missing from the checked-in migration history. This migration is idempotent:
-- existing production objects are preserved/replaced with their audited forms,
-- while a fresh local database receives the complete A03-A05/A09-A10 schema.

-- A03: a transfer group has exactly one outbound and one inbound side.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_transfer_out_group_uidx
  ON public.wallet_transactions (transfer_group_id)
  WHERE kind = 'transfer_out' AND transfer_group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_transfer_in_group_uidx
  ON public.wallet_transactions (transfer_group_id)
  WHERE kind = 'transfer_in' AND transfer_group_id IS NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_transfer_shape_chk' AND conrelid = 'public.wallet_transactions'::regclass) THEN
    ALTER TABLE public.wallet_transactions
      ADD CONSTRAINT wallet_transactions_transfer_shape_chk
      CHECK (
        kind NOT IN ('transfer_out', 'transfer_in') OR (
          transfer_group_id IS NOT NULL
          AND counterparty_wallet_id IS NOT NULL
          AND counterparty_wallet_id <> wallet_id
        )
      );
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION public.mutate_wallet_transfer(p_operation text, p_transfer_group_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;

  v_operation text;

  v_group_id uuid;

  v_from_wallet_id uuid;
  v_to_wallet_id uuid;

  v_from_currency text;
  v_to_currency text;

  v_amount numeric;
  v_happened_at date;
  v_notes text;

  v_out public.wallet_transactions%ROWTYPE;
  v_in public.wallet_transactions%ROWTYPE;

  v_out_id uuid;
  v_in_id uuid;

  v_transfer_count integer;
BEGIN

  -- ----------------------------------------------------------
  -- Authentication
  -- ----------------------------------------------------------

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_operation := lower(trim(coalesce(p_operation, '')));

  IF v_operation NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION
      'Invalid operation. Expected create, update, or delete';
  END IF;


  -- ==========================================================
  -- CREATE
  -- ==========================================================

  IF v_operation = 'create' THEN

    v_from_wallet_id :=
      NULLIF(p_data ->> 'from_wallet_id', '')::uuid;

    v_to_wallet_id :=
      NULLIF(p_data ->> 'to_wallet_id', '')::uuid;

    v_amount :=
      NULLIF(p_data ->> 'amount', '')::numeric;

    v_happened_at :=
      COALESCE(
        NULLIF(p_data ->> 'happened_at', '')::date,
        CURRENT_DATE
      );

    IF p_data ? 'notes' THEN
      v_notes := p_data ->> 'notes';
    ELSE
      v_notes := NULL;
    END IF;


    IF v_from_wallet_id IS NULL THEN
      RAISE EXCEPTION 'from_wallet_id is required';
    END IF;

    IF v_to_wallet_id IS NULL THEN
      RAISE EXCEPTION 'to_wallet_id is required';
    END IF;

    IF v_from_wallet_id = v_to_wallet_id THEN
      RAISE EXCEPTION
        'Source and destination wallets must be different';
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION
        'Transfer amount must be greater than zero';
    END IF;


    -- Lock source wallet and verify ownership.
    SELECT w.currency
    INTO v_from_currency
    FROM public.wallets w
    WHERE w.id = v_from_wallet_id
      AND w.user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Source wallet not found or access denied';
    END IF;


    -- Lock destination wallet and verify ownership.
    SELECT w.currency
    INTO v_to_currency
    FROM public.wallets w
    WHERE w.id = v_to_wallet_id
      AND w.user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Destination wallet not found or access denied';
    END IF;


    IF v_from_currency IS DISTINCT FROM v_to_currency THEN
      RAISE EXCEPTION
        'Wallet transfers require matching currencies';
    END IF;


    -- Always create the group id server-side.
    v_group_id := gen_random_uuid();


    -- OUT side.
    INSERT INTO public.wallet_transactions (
      user_id,
      wallet_id,
      kind,
      amount,
      currency,
      happened_at,
      notes,
      counterparty_wallet_id,
      transfer_group_id
    )
    VALUES (
      v_user_id,
      v_from_wallet_id,
      'transfer_out',
      v_amount,
      v_from_currency,
      v_happened_at,
      v_notes,
      v_to_wallet_id,
      v_group_id
    )
    RETURNING id INTO v_out_id;


    -- IN side.
    INSERT INTO public.wallet_transactions (
      user_id,
      wallet_id,
      kind,
      amount,
      currency,
      happened_at,
      notes,
      counterparty_wallet_id,
      transfer_group_id
    )
    VALUES (
      v_user_id,
      v_to_wallet_id,
      'transfer_in',
      v_amount,
      v_to_currency,
      v_happened_at,
      v_notes,
      v_from_wallet_id,
      v_group_id
    )
    RETURNING id INTO v_in_id;


    RETURN jsonb_build_object(
      'operation', 'create',
      'transfer_group_id', v_group_id,
      'transfer_out_id', v_out_id,
      'transfer_in_id', v_in_id
    );

  END IF;


  -- ==========================================================
  -- UPDATE / DELETE
  -- ==========================================================

  IF p_transfer_group_id IS NULL THEN
    RAISE EXCEPTION
      'transfer_group_id is required for %',
      v_operation;
  END IF;

  v_group_id := p_transfer_group_id;


  -- Lock both existing sides.
  SELECT *
  INTO v_out
  FROM public.wallet_transactions
  WHERE transfer_group_id = v_group_id
    AND kind = 'transfer_out'
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Transfer not found or access denied';
  END IF;


  SELECT *
  INTO v_in
  FROM public.wallet_transactions
  WHERE transfer_group_id = v_group_id
    AND kind = 'transfer_in'
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Transfer is incomplete or access denied';
  END IF;


  -- A valid transfer group must contain exactly 2 transfer rows.
  SELECT count(*)
  INTO v_transfer_count
  FROM public.wallet_transactions
  WHERE transfer_group_id = v_group_id
    AND kind IN ('transfer_out', 'transfer_in')
    AND user_id = v_user_id;

  IF v_transfer_count <> 2 THEN
    RAISE EXCEPTION
      'Transfer group is inconsistent';
  END IF;


  -- ==========================================================
  -- DELETE
  -- ==========================================================

  IF v_operation = 'delete' THEN

    DELETE FROM public.wallet_transactions
    WHERE transfer_group_id = v_group_id
      AND kind IN ('transfer_out', 'transfer_in')
      AND user_id = v_user_id;

    RETURN jsonb_build_object(
      'operation', 'delete',
      'transfer_group_id', v_group_id,
      'deleted', true
    );

  END IF;


  -- ==========================================================
  -- UPDATE
  -- ==========================================================

  IF p_data ? 'from_wallet_id' THEN
    v_from_wallet_id :=
      NULLIF(p_data ->> 'from_wallet_id', '')::uuid;
  ELSE
    v_from_wallet_id := v_out.wallet_id;
  END IF;


  IF p_data ? 'to_wallet_id' THEN
    v_to_wallet_id :=
      NULLIF(p_data ->> 'to_wallet_id', '')::uuid;
  ELSE
    v_to_wallet_id := v_in.wallet_id;
  END IF;


  IF p_data ? 'amount' THEN
    v_amount :=
      NULLIF(p_data ->> 'amount', '')::numeric;
  ELSE
    v_amount := v_out.amount;
  END IF;


  IF p_data ? 'happened_at' THEN
    v_happened_at :=
      NULLIF(p_data ->> 'happened_at', '')::date;
  ELSE
    v_happened_at := v_out.happened_at;
  END IF;


  IF p_data ? 'notes' THEN
    v_notes := p_data ->> 'notes';
  ELSE
    v_notes := v_out.notes;
  END IF;


  IF v_from_wallet_id IS NULL THEN
    RAISE EXCEPTION 'from_wallet_id cannot be null';
  END IF;

  IF v_to_wallet_id IS NULL THEN
    RAISE EXCEPTION 'to_wallet_id cannot be null';
  END IF;

  IF v_from_wallet_id = v_to_wallet_id THEN
    RAISE EXCEPTION
      'Source and destination wallets must be different';
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION
      'Transfer amount must be greater than zero';
  END IF;

  IF v_happened_at IS NULL THEN
    RAISE EXCEPTION
      'happened_at cannot be null';
  END IF;


  -- Lock / validate source wallet.
  SELECT w.currency
  INTO v_from_currency
  FROM public.wallets w
  WHERE w.id = v_from_wallet_id
    AND w.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Source wallet not found or access denied';
  END IF;


  -- Lock / validate destination wallet.
  SELECT w.currency
  INTO v_to_currency
  FROM public.wallets w
  WHERE w.id = v_to_wallet_id
    AND w.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Destination wallet not found or access denied';
  END IF;


  IF v_from_currency IS DISTINCT FROM v_to_currency THEN
    RAISE EXCEPTION
      'Wallet transfers require matching currencies';
  END IF;


  -- Update OUT side.
  UPDATE public.wallet_transactions
  SET
    wallet_id = v_from_wallet_id,
    counterparty_wallet_id = v_to_wallet_id,
    amount = v_amount,
    currency = v_from_currency,
    happened_at = v_happened_at,
    notes = v_notes
  WHERE id = v_out.id
    AND user_id = v_user_id;


  -- Update IN side.
  UPDATE public.wallet_transactions
  SET
    wallet_id = v_to_wallet_id,
    counterparty_wallet_id = v_from_wallet_id,
    amount = v_amount,
    currency = v_to_currency,
    happened_at = v_happened_at,
    notes = v_notes
  WHERE id = v_in.id
    AND user_id = v_user_id;


  RETURN jsonb_build_object(
    'operation', 'update',
    'transfer_group_id', v_group_id,
    'transfer_out_id', v_out.id,
    'transfer_in_id', v_in.id
  );

END;
$function$;

CREATE OR REPLACE FUNCTION public._sync_tx_from_wallet_tx()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
END;
$function$;

CREATE OR REPLACE FUNCTION public._sync_tx_from_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
END;
$function$;

CREATE OR REPLACE FUNCTION public._sync_tx_from_person_ledger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
END;
$function$;

CREATE OR REPLACE FUNCTION public._sync_tx_from_investment_tx()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dir public.txn_direction;
  v_type public.txn_type;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_kind='investment_transactions' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.tx_class = 'opex' THEN
    v_type := 'expense'; v_dir := 'out';
  ELSIF NEW.tx_class = 'income' THEN
    v_type := 'income'; v_dir := 'in';
  ELSIF NEW.tx_class = 'capex' THEN
    v_type := 'investment'; v_dir := 'out';
  ELSIF NEW.tx_class = 'sale' THEN
    v_type := 'investment'; v_dir := 'in';
  ELSIF NEW.tx_class IN ('adjustment','personal_benefit') THEN
    v_type := 'adjustment'; v_dir := 'neutral';
  ELSE
    v_type := 'investment';
    v_dir := CASE
      WHEN NEW.kind IN ('return','withdraw','capital_withdraw') THEN 'in'::public.txn_direction
      WHEN NEW.kind IN ('capital_add','principal','contribute') THEN 'out'::public.txn_direction
      ELSE 'neutral'::public.txn_direction
    END;
  END IF;

  INSERT INTO public.transactions (
    user_id, type, direction, amount, currency, happened_at,
    account_id, category_id, description, notes, source_kind, source_id, affects_balance, meta
  ) VALUES (
    NEW.user_id, v_type, v_dir, NEW.amount, NEW.currency, NEW.happened_at,
    NEW.wallet_id, NEW.category_id, NEW.notes, NEW.notes,
    'investment_transactions', NEW.id,
    (NEW.wallet_id IS NULL),
    jsonb_build_object('investment_id', NEW.investment_id, 'inv_kind', NEW.kind, 'tx_class', NEW.tx_class)
  )
  ON CONFLICT (source_kind, source_id) DO UPDATE SET
    type = EXCLUDED.type,
    direction = EXCLUDED.direction,
    amount = EXCLUDED.amount,
    happened_at = EXCLUDED.happened_at,
    account_id = EXCLUDED.account_id,
    category_id = EXCLUDED.category_id,
    notes = EXCLUDED.notes,
    meta = EXCLUDED.meta,
    updated_at = now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mutate_wallet_transfer(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_wallet_transfer(text, uuid, jsonb) TO authenticated, service_role;

-- A04: transactions is trigger-derived and client read-only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.transactions FROM anon, authenticated;
GRANT SELECT ON public.transactions TO authenticated;
DROP POLICY IF EXISTS "transactions: owner all" ON public.transactions;
DROP POLICY IF EXISTS "transactions: owner select" ON public.transactions;
CREATE POLICY "transactions: owner select" ON public.transactions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON FUNCTION public._sync_tx_from_wallet_tx() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sync_tx_from_expense() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sync_tx_from_person_ledger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sync_tx_from_investment_tx() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sync_tx_from_wallet_tx() TO service_role;
GRANT EXECUTE ON FUNCTION public._sync_tx_from_expense() TO service_role;
GRANT EXECUTE ON FUNCTION public._sync_tx_from_person_ledger() TO service_role;
GRANT EXECUTE ON FUNCTION public._sync_tx_from_investment_tx() TO service_role;

-- A05/A10: parent composite keys used to enforce tenant ownership.
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_id_id_uidx ON public.contacts(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_id_uidx ON public.wallets(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_id_uidx ON public.categories(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS projects_user_id_id_uidx ON public.projects(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS expenses_user_id_id_uidx ON public.expenses(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS investments_user_id_id_uidx ON public.investments(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS debts_user_id_id_uidx ON public.debts(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_categories_user_id_id_uidx ON public.wallet_tx_categories(user_id, id);

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='debt_payments_user_debt_fkey' AND conrelid='public.debt_payments'::regclass) THEN
    ALTER TABLE public.debt_payments ADD CONSTRAINT debt_payments_user_debt_fkey
      FOREIGN KEY (user_id, debt_id) REFERENCES public.debts(user_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expense_allocations_user_expense_fkey' AND conrelid='public.expense_allocations'::regclass) THEN
    ALTER TABLE public.expense_allocations ADD CONSTRAINT expense_allocations_user_expense_fkey
      FOREIGN KEY (user_id, expense_id) REFERENCES public.expenses(user_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='asset_market_values_user_investment_fkey' AND conrelid='public.asset_market_values'::regclass) THEN
    ALTER TABLE public.asset_market_values ADD CONSTRAINT asset_market_values_user_investment_fkey
      FOREIGN KEY (user_id, investment_id) REFERENCES public.investments(user_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='depreciation_profiles_user_investment_fkey' AND conrelid='public.depreciation_profiles'::regclass) THEN
    ALTER TABLE public.depreciation_profiles ADD CONSTRAINT depreciation_profiles_user_investment_fkey
      FOREIGN KEY (user_id, investment_id) REFERENCES public.investments(user_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='investment_transactions_user_investment_fkey' AND conrelid='public.investment_transactions'::regclass) THEN
    ALTER TABLE public.investment_transactions ADD CONSTRAINT investment_transactions_user_investment_fkey
      FOREIGN KEY (user_id, investment_id) REFERENCES public.investments(user_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='investment_transactions_user_wallet_fkey' AND conrelid='public.investment_transactions'::regclass) THEN
    ALTER TABLE public.investment_transactions ADD CONSTRAINT investment_transactions_user_wallet_fkey
      FOREIGN KEY (user_id, wallet_id) REFERENCES public.wallets(user_id, id) ON DELETE SET NULL (wallet_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='person_ledger_user_contact_fkey' AND conrelid='public.person_ledger'::regclass) THEN
    ALTER TABLE public.person_ledger ADD CONSTRAINT person_ledger_user_contact_fkey
      FOREIGN KEY (user_id, contact_id) REFERENCES public.contacts(user_id, id) ON DELETE SET NULL (contact_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='person_ledger_user_wallet_fkey' AND conrelid='public.person_ledger'::regclass) THEN
    ALTER TABLE public.person_ledger ADD CONSTRAINT person_ledger_user_wallet_fkey
      FOREIGN KEY (user_id, wallet_id) REFERENCES public.wallets(user_id, id) ON DELETE SET NULL (wallet_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expenses_user_category_fkey' AND conrelid='public.expenses'::regclass) THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_user_category_fkey
      FOREIGN KEY (user_id, category_id) REFERENCES public.categories(user_id, id) ON DELETE SET NULL (category_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expenses_user_project_fkey' AND conrelid='public.expenses'::regclass) THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_user_project_fkey
      FOREIGN KEY (user_id, project_id) REFERENCES public.projects(user_id, id) ON DELETE SET NULL (project_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expenses_user_wallet_fkey' AND conrelid='public.expenses'::regclass) THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_user_wallet_fkey
      FOREIGN KEY (user_id, wallet_id) REFERENCES public.wallets(user_id, id) ON DELETE SET NULL (wallet_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='investments_user_parent_fkey' AND conrelid='public.investments'::regclass) THEN
    ALTER TABLE public.investments ADD CONSTRAINT investments_user_parent_fkey
      FOREIGN KEY (user_id, parent_investment_id) REFERENCES public.investments(user_id, id) ON DELETE SET NULL (parent_investment_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='investments_user_wallet_fkey' AND conrelid='public.investments'::regclass) THEN
    ALTER TABLE public.investments ADD CONSTRAINT investments_user_wallet_fkey
      FOREIGN KEY (user_id, wallet_id) REFERENCES public.wallets(user_id, id) ON DELETE SET NULL (wallet_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wallet_transactions_user_category_fkey' AND conrelid='public.wallet_transactions'::regclass) THEN
    ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_user_category_fkey
      FOREIGN KEY (user_id, category_id) REFERENCES public.wallet_tx_categories(user_id, id) ON DELETE SET NULL (category_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wallet_transactions_user_contact_fkey' AND conrelid='public.wallet_transactions'::regclass) THEN
    ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_user_contact_fkey
      FOREIGN KEY (user_id, contact_id) REFERENCES public.contacts(user_id, id) ON DELETE SET NULL (contact_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wallet_transactions_user_counterparty_wallet_fkey' AND conrelid='public.wallet_transactions'::regclass) THEN
    ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_user_counterparty_wallet_fkey
      FOREIGN KEY (user_id, counterparty_wallet_id) REFERENCES public.wallets(user_id, id) ON DELETE SET NULL (counterparty_wallet_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wallet_transactions_user_wallet_fkey' AND conrelid='public.wallet_transactions'::regclass) THEN
    ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_user_wallet_fkey
      FOREIGN KEY (user_id, wallet_id) REFERENCES public.wallets(user_id, id) ON DELETE CASCADE;
  END IF;
END
$migration$;

-- A09: one valuation per day and one depreciation profile per investment.
CREATE UNIQUE INDEX IF NOT EXISTS asset_market_values_user_investment_date_uidx
  ON public.asset_market_values(user_id, investment_id, valuation_date);
CREATE UNIQUE INDEX IF NOT EXISTS depreciation_profiles_user_investment_uidx
  ON public.depreciation_profiles(user_id, investment_id);
