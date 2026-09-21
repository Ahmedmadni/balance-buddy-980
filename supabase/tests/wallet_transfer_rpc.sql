-- A03 integration regression tests. Disposable/local database only.
BEGIN;

DO $test$
DECLARE
  owner_id uuid := '12000000-0000-0000-0000-000000000001';
  wallet_a uuid := '32000000-0000-0000-0000-000000000001';
  wallet_b uuid := '32000000-0000-0000-0000-000000000002';
  wallet_c uuid := '32000000-0000-0000-0000-000000000003';
  wallet_usd uuid := '32000000-0000-0000-0000-000000000004';
  transfer_id uuid;
  result jsonb;
  n bigint;
  failed boolean;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'a03-owner@example.invalid', '', now());
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.wallets (id, user_id, name, currency) VALUES
    (wallet_a, owner_id, 'A', 'SAR'), (wallet_b, owner_id, 'B', 'SAR'),
    (wallet_c, owner_id, 'C', 'SAR'), (wallet_usd, owner_id, 'USD', 'USD');

  result := public.mutate_wallet_transfer('create', NULL, jsonb_build_object(
    'from_wallet_id', wallet_a, 'to_wallet_id', wallet_b, 'amount', 250,
    'happened_at', '2026-09-01', 'notes', 'A03 create'));
  transfer_id := (result->>'transfer_group_id')::uuid;

  SELECT count(*) INTO n FROM public.wallet_transactions WHERE transfer_group_id = transfer_id;
  IF n <> 2 THEN RAISE EXCEPTION 'A03 create must produce exactly two wallet sides'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE transfer_group_id=transfer_id AND wallet_id=wallet_a AND counterparty_wallet_id=wallet_b AND kind='transfer_out' AND amount=250)
    OR NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE transfer_group_id=transfer_id AND wallet_id=wallet_b AND counterparty_wallet_id=wallet_a AND kind='transfer_in' AND amount=250)
  THEN RAISE EXCEPTION 'A03 create sides are not reciprocal'; END IF;

  PERFORM public.mutate_wallet_transfer('update', transfer_id, jsonb_build_object(
    'from_wallet_id', wallet_b, 'to_wallet_id', wallet_c, 'amount', 400,
    'happened_at', '2026-09-02', 'notes', 'A03 update'));
  SELECT count(*) INTO n FROM public.wallet_transactions WHERE transfer_group_id = transfer_id;
  IF n <> 2
    OR NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE transfer_group_id=transfer_id AND wallet_id=wallet_b AND kind='transfer_out' AND amount=400)
    OR NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE transfer_group_id=transfer_id AND wallet_id=wallet_c AND kind='transfer_in' AND amount=400)
  THEN RAISE EXCEPTION 'A03 update did not atomically reconcile both sides'; END IF;

  failed := false;
  BEGIN
    PERFORM public.mutate_wallet_transfer('create', NULL, jsonb_build_object(
      'from_wallet_id', wallet_a, 'to_wallet_id', wallet_a, 'amount', 1));
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IS DISTINCT FROM 'Source and destination wallets must be different' THEN RAISE; END IF;
    failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'A03 same-wallet transfer was accepted'; END IF;

  failed := false;
  BEGIN
    PERFORM public.mutate_wallet_transfer('create', NULL, jsonb_build_object(
      'from_wallet_id', wallet_a, 'to_wallet_id', wallet_usd, 'amount', 1));
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IS DISTINCT FROM 'Wallet transfers require matching currencies' THEN RAISE; END IF;
    failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'A03 incompatible currency was accepted'; END IF;

  PERFORM public.mutate_wallet_transfer('delete', transfer_id, '{}'::jsonb);
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE transfer_group_id = transfer_id)
    OR EXISTS (SELECT 1 FROM public.transactions WHERE transfer_group_id = transfer_id)
  THEN RAISE EXCEPTION 'A03 delete must remove both source and derived sides'; END IF;
END
$test$;

ROLLBACK;
