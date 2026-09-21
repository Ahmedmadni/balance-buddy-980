-- A04 integration regression tests. Disposable/local database only.
BEGIN;

DO $test$
DECLARE
  owner_id uuid := '13000000-0000-0000-0000-000000000001';
  wallet_id uuid := '33000000-0000-0000-0000-000000000001';
  wallet_tx_id uuid := '43000000-0000-0000-0000-000000000001';
  n bigint;
BEGIN
  IF has_table_privilege('authenticated', 'public.transactions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.transactions', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.transactions', 'DELETE')
  THEN RAISE EXCEPTION 'A04 authenticated must not have direct transactions DML privileges'; END IF;
  IF NOT has_table_privilege('authenticated', 'public.transactions', 'SELECT')
  THEN RAISE EXCEPTION 'A04 authenticated must retain transactions SELECT'; END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'a04-owner@example.invalid', '', now());
  INSERT INTO public.wallets (id, user_id, name, currency) VALUES (wallet_id, owner_id, 'A04 wallet', 'SAR');

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.wallet_transactions
    (id, user_id, wallet_id, kind, amount, currency, happened_at, notes)
  VALUES (wallet_tx_id, owner_id, wallet_id, 'deposit', 10, 'SAR', '2026-09-01', 'A04 insert');
  SELECT count(*) INTO n FROM public.transactions t
  WHERE t.source_kind='wallet_transactions' AND t.source_id=wallet_tx_id AND t.amount=10 AND t.direction='in';
  IF n <> 1 THEN RAISE EXCEPTION 'A04 source insert did not create one derived row'; END IF;

  UPDATE public.wallet_transactions SET amount=20, kind='withdraw', notes='A04 update' WHERE id=wallet_tx_id;
  SELECT count(*) INTO n FROM public.transactions t
  WHERE t.source_kind='wallet_transactions' AND t.source_id=wallet_tx_id AND t.amount=20 AND t.direction='out';
  IF n <> 1 THEN RAISE EXCEPTION 'A04 source update did not reconcile the derived row'; END IF;

  DELETE FROM public.wallet_transactions WHERE id=wallet_tx_id;
  IF EXISTS (SELECT 1 FROM public.transactions t WHERE t.source_kind='wallet_transactions' AND t.source_id=wallet_tx_id)
  THEN RAISE EXCEPTION 'A04 source delete did not delete the derived row'; END IF;
END
$test$;

ROLLBACK;
