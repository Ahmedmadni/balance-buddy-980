-- Phase 14: server-side idempotency regression in a disposable DB only.
-- Never run against a real user's production project.
BEGIN;

DO $test$
DECLARE
  user_a uuid := '16000000-0000-0000-0000-0000000000a4';
  user_b uuid := '16000000-0000-0000-0000-0000000000b4';
  wallet_a uuid := '36000000-0000-0000-0000-0000000000a4';
  wallet_b uuid := '36000000-0000-0000-0000-0000000000b4';
  op uuid := '46000000-0000-0000-0000-0000000000a4';
  failed_op uuid := '46000000-0000-0000-0000-0000000000f4';
  backup_a jsonb;
  backup_b jsonb;
  response jsonb;
  status_response jsonb;
  failure_state text;
BEGIN
  -- Commit markers must not be writable/readable directly from REST-backed
  -- authenticated role: only private SECURITY DEFINER helpers can access them.
  IF has_table_privilege('authenticated', 'rasd_internal.restore_operation_journal', 'SELECT')
     OR has_table_privilege('authenticated', 'rasd_internal.restore_operation_journal', 'INSERT')
     OR has_table_privilege('authenticated', 'rasd_internal.restore_operation_journal', 'UPDATE')
     OR has_table_privilege('authenticated', 'rasd_internal.restore_operation_journal', 'DELETE') THEN
    RAISE EXCEPTION 'A14 authoritative journal has unsafe direct role grants';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at
  ) VALUES
    (user_a, '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'a14-owner@example.invalid', '', now()),
    (user_b, '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'a14-other@example.invalid', '', now());

  PERFORM set_config('request.jwt.claim.sub', user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.wallets (id, user_id, name, currency, opening_balance)
  VALUES (wallet_a, user_a, 'A14 original', 'SAR', 150);
  backup_a := public.export_user_backup();

  -- One confirmed restore should be committed and journaled exactly once.
  UPDATE public.wallets SET name = 'before first restore' WHERE id = wallet_a;
  response := public.restore_user_backup_once(backup_a, op);
  IF response->>'ok' IS DISTINCT FROM 'true'
     OR response->>'replayed' IS DISTINCT FROM 'false'
     OR response->>'operation_id' IS DISTINCT FROM op::text
     OR (SELECT name FROM public.wallets WHERE id = wallet_a) IS DISTINCT FROM 'A14 original'
     OR (SELECT count(*) FROM rasd_internal.restore_operation_journal
         WHERE user_id = user_a AND operation_id = op) <> 1 THEN
    RAISE EXCEPTION 'A14 initial restore was not committed and journaled';
  END IF;

  -- Lost HTTP response: retransmitting SAME operation ID must NOT restore
  -- again; even a later mutation is preserved.
  UPDATE public.wallets SET name = 'changed after commit' WHERE id = wallet_a;
  response := public.restore_user_backup_once(backup_a, op);
  IF response->>'replayed' IS DISTINCT FROM 'true'
     OR (SELECT name FROM public.wallets WHERE id = wallet_a)
        IS DISTINCT FROM 'changed after commit' THEN
    RAISE EXCEPTION 'A14 duplicate request executed the destructive restore again';
  END IF;

  -- Same operation ID + different data must be refused before mutations.
  failure_state := NULL;
  BEGIN
    PERFORM public.restore_user_backup_once(
      jsonb_set(backup_a, '{data,wallets,0,name}', '"different payload"'::jsonb),
      op
    );
  EXCEPTION WHEN OTHERS THEN
    failure_state := SQLSTATE;
  END;
  IF failure_state IS DISTINCT FROM '22023'
     OR (SELECT name FROM public.wallets WHERE id = wallet_a)
       IS DISTINCT FROM 'changed after commit' THEN
    RAISE EXCEPTION 'A14 operation-id collision was not rejected';
  END IF;

  -- A bad backup must never leave a committed journal row, and must not
  -- delete any financial records in the same SQL transaction.
  failure_state := NULL;
  BEGIN
    PERFORM public.restore_user_backup_once(backup_a #- '{data,contacts}', failed_op);
  EXCEPTION WHEN OTHERS THEN
    failure_state := SQLSTATE;
  END;
  IF failure_state IS NULL
     OR EXISTS (SELECT 1 FROM rasd_internal.restore_operation_journal
                 WHERE user_id = user_a AND operation_id = failed_op)
     OR (SELECT name FROM public.wallets WHERE id = wallet_a)
       IS DISTINCT FROM 'changed after commit' THEN
    RAISE EXCEPTION 'A14 failed restore left a journal row or changed balances';
  END IF;

  status_response := public.get_restore_operation_status(op);
  IF status_response->>'status' IS DISTINCT FROM 'committed'
     OR status_response->>'operation_id' IS DISTINCT FROM op::text
     OR public.get_restore_operation_status(failed_op)->>'status'
        IS DISTINCT FROM 'not_found' THEN
    RAISE EXCEPTION 'A14 status query could not resolve committed/failed operations';
  END IF;

  -- Account B cannot observe A's restore entry, even with the same operation
  -- UUID; composite key and auth.uid scope isolate the accounts.
  PERFORM set_config('request.jwt.claim.sub', user_b::text, true);
  IF public.get_restore_operation_status(op)->>'status' IS DISTINCT FROM 'not_found' THEN
    RAISE EXCEPTION 'A14 user B could read user A operation status';
  END IF;
  INSERT INTO public.wallets (id, user_id, name, currency, opening_balance)
  VALUES (wallet_b, user_b, 'A14 second account', 'SAR', 200);
  backup_b := public.export_user_backup();
  response := public.restore_user_backup_once(backup_b, op);
  IF response->>'replayed' IS DISTINCT FROM 'false'
     OR (SELECT count(*) FROM rasd_internal.restore_operation_journal
          WHERE operation_id = op) <> 2
     OR (SELECT name FROM public.wallets WHERE id = wallet_a)
        IS DISTINCT FROM 'changed after commit' THEN
    RAISE EXCEPTION 'A14 operation ID reuse between accounts crossed ownership boundary';
  END IF;

  -- Authentication is mandatory even when operation ID is known.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  failure_state := NULL;
  BEGIN
    PERFORM public.get_restore_operation_status(op);
  EXCEPTION WHEN OTHERS THEN
    failure_state := SQLSTATE;
  END;
  IF failure_state IS NULL THEN
    RAISE EXCEPTION 'A14 anonymous operation status was not rejected';
  END IF;
END;
$test$;

ROLLBACK;
