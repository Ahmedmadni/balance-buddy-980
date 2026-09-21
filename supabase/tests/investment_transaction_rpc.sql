-- A02 integration test. Run against a disposable database after all migrations.
-- The transaction is rolled back and never changes user data.
BEGIN;

DO $test$
DECLARE
  owner_id uuid := '11000000-0000-0000-0000-000000000001';
  other_id uuid := '11000000-0000-0000-0000-000000000002';
  investment_id uuid := '21000000-0000-0000-0000-000000000001';
  wallet_a uuid := '31000000-0000-0000-0000-000000000001';
  wallet_b uuid := '31000000-0000-0000-0000-000000000002';
  other_wallet uuid := '31000000-0000-0000-0000-000000000003';
  transaction_id uuid;
  result jsonb;
  n bigint;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a02-owner@example.invalid', '', now()),
    (other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a02-other@example.invalid', '', now());
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.wallets (id, user_id, name, currency) VALUES
    (wallet_a, owner_id, 'A', 'SAR'), (wallet_b, owner_id, 'B', 'SAR'),
    (other_wallet, other_id, 'Other', 'SAR');
  INSERT INTO public.investments
    (id, user_id, name, type, principal, current_value, currency, start_date)
  VALUES (investment_id, owner_id, 'A02 asset', 'stocks', 100, 100, 'SAR', '2026-09-01');

  result := public.mutate_investment_transaction('create', NULL, jsonb_build_object(
    'investment_id', investment_id, 'kind', 'capital_add', 'tx_class', 'capex',
    'amount', 100, 'currency', 'SAR', 'wallet_id', wallet_a,
    'affects_wallet', true, 'happened_at', '2026-09-01'));
  transaction_id := (result->>'id')::uuid;
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind = 'investment_transactions' AND source_id = transaction_id
    AND wallet_id = wallet_a AND kind = 'withdraw' AND amount = 100;
  IF n <> 1 THEN RAISE EXCEPTION 'create did not produce exactly one withdrawal'; END IF;

  -- A11: a non-wallet-affecting adjustment never creates a cash mirror.
  result := public.mutate_investment_transaction('create', NULL, jsonb_build_object(
    'investment_id', investment_id, 'kind', 'revaluation', 'tx_class', 'adjustment',
    'amount', 125, 'currency', 'SAR', 'wallet_id', wallet_a,
    'affects_wallet', false, 'happened_at', '2026-09-01'));
  IF (result->>'wallet_mirror')::boolean OR EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE source_kind='investment_transactions' AND source_id=(result->>'id')::uuid
  ) THEN RAISE EXCEPTION 'non-wallet adjustment created a wallet mirror'; END IF;

  -- A11: a sale updates the authoritative sold snapshot and creates one deposit.
  result := public.mutate_investment_transaction('create', NULL, jsonb_build_object(
    'investment_id', investment_id, 'kind', 'withdraw', 'tx_class', 'sale',
    'amount', 75, 'currency', 'SAR', 'wallet_id', wallet_a,
    'affects_wallet', true, 'update_investment', true, 'happened_at', '2026-09-02'));
  IF (SELECT status FROM public.investments WHERE id=investment_id) <> 'sold'
    OR (SELECT sold_amount FROM public.investments WHERE id=investment_id) <> 75
  THEN RAISE EXCEPTION 'sale did not reconcile sold state'; END IF;
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind='investment_transactions' AND source_id=(result->>'id')::uuid
    AND kind='deposit' AND amount=75;
  IF n <> 1 THEN RAISE EXCEPTION 'sale did not create exactly one wallet deposit'; END IF;

  PERFORM public.mutate_investment_transaction('update', transaction_id,
    jsonb_build_object('amount', 150, 'wallet_id', wallet_b, 'kind', 'return', 'tx_class', 'income'));
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind = 'investment_transactions' AND source_id = transaction_id
    AND wallet_id = wallet_b AND kind = 'deposit' AND amount = 150;
  IF n <> 1 THEN RAISE EXCEPTION 'update did not reconcile the existing mirror'; END IF;

  BEGIN
    PERFORM public.mutate_investment_transaction('update', transaction_id,
      jsonb_build_object('wallet_id', other_wallet));
    RAISE EXCEPTION 'cross-owner wallet should have failed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF (SELECT wallet_id FROM public.investment_transactions WHERE id = transaction_id) IS DISTINCT FROM wallet_b
    OR (SELECT amount FROM public.wallet_transactions WHERE source_kind = 'investment_transactions' AND source_id = transaction_id) IS DISTINCT FROM 150::numeric
  THEN RAISE EXCEPTION 'failed update was not atomic'; END IF;

  PERFORM public.mutate_investment_transaction('update', transaction_id,
    jsonb_build_object('amount', 151));
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind='investment_transactions' AND source_id=transaction_id;
  IF n <> 1 THEN RAISE EXCEPTION 'repeated reconciliation created a duplicate wallet mirror'; END IF;

  PERFORM public.mutate_investment_transaction('update', transaction_id,
    jsonb_build_object('wallet_id', NULL));
  IF EXISTS (SELECT 1 FROM public.wallet_transactions
    WHERE source_kind = 'investment_transactions' AND source_id = transaction_id)
  THEN RAISE EXCEPTION 'removing wallet did not remove mirror'; END IF;

  PERFORM public.mutate_investment_transaction('delete', transaction_id);
  IF EXISTS (SELECT 1 FROM public.investment_transactions WHERE id = transaction_id)
    OR EXISTS (SELECT 1 FROM public.wallet_transactions
      WHERE source_kind = 'investment_transactions' AND source_id = transaction_id)
  THEN RAISE EXCEPTION 'delete did not remove source and mirror'; END IF;

  IF has_function_privilege('anon', 'public.mutate_investment_transaction(text,uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.mutate_investment_transaction(text,uuid,jsonb)', 'EXECUTE')
  THEN RAISE EXCEPTION 'function grants are incorrect'; END IF;
END
$test$;

ROLLBACK;
