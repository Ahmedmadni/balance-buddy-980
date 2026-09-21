-- A01 integration test. Run against a disposable Supabase database after all
-- migrations. The transaction is always rolled back and never changes user data.
BEGIN;

CREATE FUNCTION pg_temp.reject_forced_a01_delete() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF current_setting('a01.force_delete_failure', true) = 'on' AND OLD.source_kind = 'person_ledger' THEN
    RAISE EXCEPTION 'forced delete failure';
  END IF;
  RETURN OLD;
END
$function$;

CREATE TRIGGER a01_reject_forced_delete
  BEFORE DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_forced_a01_delete();

DO $test$
DECLARE
  owner_id uuid := '10000000-0000-0000-0000-000000000001';
  other_id uuid := '10000000-0000-0000-0000-000000000002';
  contact_id uuid := '20000000-0000-0000-0000-000000000001';
  wallet_a uuid := '30000000-0000-0000-0000-000000000001';
  wallet_b uuid := '30000000-0000-0000-0000-000000000002';
  other_wallet uuid := '30000000-0000-0000-0000-000000000003';
  ledger_id uuid;
  unlinked_id uuid;
  legacy_id uuid := '40000000-0000-0000-0000-000000000001';
  result jsonb;
  n bigint;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a01-owner@example.invalid', '', now()),
    (other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a01-other@example.invalid', '', now());

  -- handle_new_user creates profiles/categories; establish the owner JWT after setup.
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.contacts (id, user_id, name)
  VALUES (contact_id, owner_id, 'أحمد');
  INSERT INTO public.wallets (id, user_id, name, currency)
  VALUES
    (wallet_a, owner_id, 'A', 'SAR'),
    (wallet_b, owner_id, 'B', 'SAR'),
    (other_wallet, other_id, 'Other', 'SAR');

  -- 1: create without wallet.
  result := public.mutate_person_ledger('create', NULL, jsonb_build_object(
    'contact_id', contact_id, 'contact_name', 'أحمد', 'kind', 'lend',
    'amount', 100, 'currency', 'SAR', 'happened_at', '2026-08-01'
  ));
  unlinked_id := (result->>'id')::uuid;
  IF (result->>'wallet_mirror')::boolean OR EXISTS (
    SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=unlinked_id
  ) THEN RAISE EXCEPTION 'test 1 failed'; END IF;

  -- 2/4: lend creates one wallet withdrawal and one balance-affecting derived row.
  result := public.mutate_person_ledger('create', NULL, jsonb_build_object(
    'contact_id', contact_id, 'contact_name', 'أحمد', 'kind', 'lend',
    'amount', 1000, 'currency', 'SAR', 'happened_at', '2026-08-02', 'wallet_id', wallet_a
  ));
  ledger_id := (result->>'id')::uuid;
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind='person_ledger' AND source_id=ledger_id AND wallet_id=wallet_a AND kind='withdraw' AND amount=1000;
  IF n <> 1 THEN RAISE EXCEPTION 'tests 2/4 failed'; END IF;
  SELECT count(*) INTO n FROM public.transactions
  WHERE affects_balance AND account_id=wallet_a AND source_kind='wallet_transactions'
    AND source_id=(SELECT id FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=ledger_id);
  IF n <> 1 THEN RAISE EXCEPTION 'derived wallet effect failed'; END IF;

  -- 3: borrow creates a deposit.
  result := public.mutate_person_ledger('create', NULL, jsonb_build_object(
    'contact_id', contact_id, 'contact_name', 'أحمد', 'kind', 'borrow',
    'amount', 200, 'currency', 'SAR', 'happened_at', '2026-08-03', 'wallet_id', wallet_a
  ));
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind='person_ledger' AND source_id=(result->>'id')::uuid AND kind='deposit';
  IF n <> 1 THEN RAISE EXCEPTION 'test 3 failed'; END IF;

  -- A11: pay is the fourth canonical direction and creates one withdrawal.
  result := public.mutate_person_ledger('create', NULL, jsonb_build_object(
    'contact_id', contact_id, 'contact_name', 'أحمد', 'kind', 'pay',
    'amount', 50, 'currency', 'SAR', 'happened_at', '2026-08-04', 'wallet_id', wallet_a
  ));
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind='person_ledger' AND source_id=(result->>'id')::uuid
    AND wallet_id=wallet_a AND kind='withdraw' AND amount=50;
  IF n <> 1 THEN RAISE EXCEPTION 'A11 pay direction failed'; END IF;

  -- 5: amount update reconciles the existing mirror.
  PERFORM public.mutate_person_ledger('update', ledger_id, '{"amount":1500}'::jsonb);
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind='person_ledger' AND source_id=ledger_id AND amount=1500;
  IF n <> 1 THEN RAISE EXCEPTION 'test 5 failed'; END IF;

  -- 6: moving A -> B removes A's effect by updating the only mirror.
  PERFORM public.mutate_person_ledger('update', ledger_id, jsonb_build_object('wallet_id', wallet_b));
  SELECT count(*) INTO n FROM public.wallet_transactions
  WHERE source_kind='person_ledger' AND source_id=ledger_id AND wallet_id=wallet_b;
  IF n <> 1 OR EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=ledger_id AND wallet_id=wallet_a)
  THEN RAISE EXCEPTION 'test 6 failed'; END IF;

  -- 7/8: remove wallet, then add it to the previously unlinked row.
  PERFORM public.mutate_person_ledger('update', ledger_id, '{"wallet_id":null}'::jsonb);
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=ledger_id)
  THEN RAISE EXCEPTION 'test 7 failed'; END IF;
  PERFORM public.mutate_person_ledger('update', unlinked_id, jsonb_build_object('wallet_id', wallet_a));
  IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=unlinked_id)
  THEN RAISE EXCEPTION 'test 8 failed'; END IF;

  -- 9: direction change updates the same mirror.
  PERFORM public.mutate_person_ledger('update', unlinked_id, '{"kind":"collect"}'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=unlinked_id AND kind='deposit')
  THEN RAISE EXCEPTION 'test 9 failed'; END IF;

  -- 14: invalid wallet rolls back the source insert.
  BEGIN
    PERFORM public.mutate_person_ledger('create', NULL, jsonb_build_object(
      'contact_id', contact_id, 'contact_name', 'invalid-wallet', 'kind', 'lend',
      'amount', 1, 'currency', 'SAR', 'wallet_id', gen_random_uuid()
    ));
    RAISE EXCEPTION 'test 14 expected failure';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.person_ledger WHERE contact_name='invalid-wallet')
  THEN RAISE EXCEPTION 'test 14 rollback failed'; END IF;

  -- 15: another user's wallet is rejected and leaves no source.
  BEGIN
    PERFORM public.mutate_person_ledger('create', NULL, jsonb_build_object(
      'contact_id', contact_id, 'contact_name', 'unauthorized-wallet', 'kind', 'lend',
      'amount', 1, 'currency', 'SAR', 'wallet_id', other_wallet
    ));
    RAISE EXCEPTION 'test 15 expected failure';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.person_ledger WHERE contact_name='unauthorized-wallet')
  THEN RAISE EXCEPTION 'test 15 rollback failed'; END IF;

  -- 16: failed update preserves the old source and mirror amount.
  BEGIN
    PERFORM public.mutate_person_ledger('update', unlinked_id, '{"amount":-1}'::jsonb);
    RAISE EXCEPTION 'test 16 expected failure';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF (SELECT amount FROM public.person_ledger WHERE id=unlinked_id) <> 100
    OR (SELECT amount FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=unlinked_id) <> 100
  THEN RAISE EXCEPTION 'test 16 rollback failed'; END IF;

  -- 10-13: linked deletion removes source, mirror and both trigger-derived rows.
  PERFORM public.mutate_person_ledger('delete', unlinked_id);
  IF EXISTS (SELECT 1 FROM public.person_ledger WHERE id=unlinked_id)
    OR EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=unlinked_id)
    OR EXISTS (SELECT 1 FROM public.transactions WHERE source_kind='person_ledger' AND source_id=unlinked_id)
  THEN RAISE EXCEPTION 'tests 10-13 failed'; END IF;

  -- 17: force the mirror delete to fail; the enclosing function statement
  -- must preserve both source and mirror.
  result := public.mutate_person_ledger('create', NULL, jsonb_build_object(
    'contact_id', contact_id, 'contact_name', 'rollback-delete', 'kind', 'lend',
    'amount', 33, 'currency', 'SAR', 'wallet_id', wallet_a
  ));
  ledger_id := (result->>'id')::uuid;
  PERFORM set_config('a01.force_delete_failure', 'on', true);
  BEGIN
    PERFORM public.mutate_person_ledger('delete', ledger_id);
    RAISE EXCEPTION 'test 17 expected failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'test 17 expected failure' THEN RAISE; END IF;
  END;
  PERFORM set_config('a01.force_delete_failure', 'off', true);
  IF NOT EXISTS (SELECT 1 FROM public.person_ledger WHERE id=ledger_id)
    OR NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=ledger_id)
  THEN RAISE EXCEPTION 'test 17 rollback failed'; END IF;

  -- 18/19: uniqueness and a single balance-affecting derived effect.
  SELECT count(*) INTO n FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=ledger_id;
  IF n <> 1 THEN RAISE EXCEPTION 'test 18 failed'; END IF;
  PERFORM public.mutate_person_ledger('update', ledger_id, '{"amount":34}'::jsonb);
  SELECT count(*) INTO n FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=ledger_id;
  IF n <> 1 THEN RAISE EXCEPTION 'A11 repeated reconciliation created a duplicate mirror'; END IF;
  SELECT count(*) INTO n FROM public.transactions WHERE affects_balance AND account_id=wallet_a
    AND source_kind='wallet_transactions'
    AND source_id=(SELECT id FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=ledger_id);
  IF n <> 1 THEN RAISE EXCEPTION 'test 19 failed'; END IF;

  -- 20: an existing historical row is not changed by unrelated commands.
  INSERT INTO public.person_ledger (id,user_id,contact_id,contact_name,kind,amount,currency,happened_at)
  VALUES (legacy_id,owner_id,contact_id,'historical', 'lend',77,'SAR','2020-01-01');
  PERFORM public.mutate_person_ledger('update', ledger_id, '{"notes":"unrelated"}'::jsonb);
  IF (SELECT amount FROM public.person_ledger WHERE id=legacy_id) <> 77
    OR EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_kind='person_ledger' AND source_id=legacy_id)
  THEN RAISE EXCEPTION 'test 20 failed'; END IF;
END
$test$;

ROLLBACK;
