
-- 1) Extend investments with unified Asset fields
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS asset_kind text,
  ADD COLUMN IF NOT EXISTS base_value numeric,
  ADD COLUMN IF NOT EXISTS sold_at date,
  ADD COLUMN IF NOT EXISTS sold_amount numeric,
  ADD COLUMN IF NOT EXISTS realized_pnl numeric;

-- Backfill asset_kind from existing `type` column for legacy rows
UPDATE public.investments
SET asset_kind = COALESCE(asset_kind, type)
WHERE asset_kind IS NULL;

-- Backfill base_value from principal
UPDATE public.investments
SET base_value = COALESCE(base_value, principal)
WHERE base_value IS NULL;

-- 2) Extend investment_transactions
ALTER TABLE public.investment_transactions
  ADD COLUMN IF NOT EXISTS tx_class text,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS affects_wallet boolean NOT NULL DEFAULT true;

-- Backfill tx_class from existing kinds
UPDATE public.investment_transactions
SET tx_class = CASE
  WHEN kind IN ('capital_add','principal','contribute') THEN 'capex'
  WHEN kind IN ('return') THEN 'income'
  WHEN kind IN ('withdraw','capital_withdraw') THEN 'sale'
  WHEN kind = 'revaluation' THEN 'adjustment'
  ELSE 'capex'
END
WHERE tx_class IS NULL;

-- 3) Update sync trigger so OpEx flows into monthly expenses, Income into income reports
CREATE OR REPLACE FUNCTION public._sync_tx_from_investment_tx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_dir public.txn_direction;
  v_type public.txn_type;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_kind='investment_transactions' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Decide type + direction from tx_class first, fall back to legacy kind
  IF NEW.tx_class = 'opex' THEN
    v_type := 'expense'; v_dir := 'out';
  ELSIF NEW.tx_class = 'income' THEN
    v_type := 'income'; v_dir := 'in';
  ELSIF NEW.tx_class = 'capex' THEN
    v_type := 'investment'; v_dir := 'out';
  ELSIF NEW.tx_class = 'sale' THEN
    v_type := 'investment'; v_dir := 'in';
  ELSIF NEW.tx_class = 'adjustment' THEN
    v_type := 'adjustment'; v_dir := 'neutral';
  ELSIF NEW.tx_class = 'personal_benefit' THEN
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
    (NEW.wallet_id IS NULL) OR (NEW.affects_wallet = false) = false,
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
END $function$;
