
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
END $function$;
