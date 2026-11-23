-- Phase 15 — lost-response cancellation fence, disposable database ONLY.
BEGIN;
DO $test$
DECLARE
  owner_a uuid := '17000000-0000-0000-0000-0000000000a5';
  owner_b uuid := '17000000-0000-0000-0000-0000000000b5';
  wallet_a uuid := '37000000-0000-0000-0000-0000000000a5';
  op_cancel uuid := '47000000-0000-0000-0000-0000000000a5';
  op_done uuid := '47000000-0000-0000-0000-0000000000b5';
  op_unknown uuid := '47000000-0000-0000-0000-0000000000c5';
  snapshot jsonb;
  outcome jsonb;
  failure_code text;
BEGIN
  INSERT INTO auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','phase15-a@example.invalid','',now()),
    (owner_b, '00000000-0000-0000-0000-000000000000',
     'authenticated','authenticated','phase15-b@example.invalid','',now());

  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.wallets (id, user_id, name, currency, opening_balance)
  VALUES (wallet_a, owner_a, 'phase15 original', 'SAR', 125);
  snapshot := public.export_user_backup();

  -- A missing status is not permission to retry, but a cancellation safely
  -- inserts a permanent tombstone under the same lock as a restore.
  IF public.get_restore_operation_status(op_cancel)->>'status'
       IS DISTINCT FROM 'not_found' THEN
    RAISE EXCEPTION 'phase15 expected unknown restore status';
  END IF;

  outcome := public.cancel_restore_operation(op_cancel);
  IF outcome->>'status' IS DISTINCT FROM 'cancelled'
     OR outcome->>'operation_id' IS DISTINCT FROM op_cancel::text
     OR public.get_restore_operation_status(op_cancel)->>'status'
       IS DISTINCT FROM 'cancelled'
     OR (SELECT operation_status FROM rasd_internal.restore_operation_journal
          WHERE user_id=owner_a AND operation_id=op_cancel) IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'phase15 cancellation failed to reserve a durable tombstone';
  END IF;

  -- Exact same cancellation is idempotent.
  IF public.cancel_restore_operation(op_cancel)->>'status' IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'phase15 cancellation was not idempotent';
  END IF;

  UPDATE public.wallets SET name = 'phase15 after cancellation' WHERE id = wallet_a;
  failure_code := NULL;
  BEGIN
    -- Simulate delayed packet arriving AFTER user received cancellation ACK.
    PERFORM public.restore_user_backup_once(snapshot, op_cancel);
  EXCEPTION WHEN OTHERS THEN
    failure_code := SQLSTATE;
  END;
  IF failure_code IS DISTINCT FROM 'P0001'
     OR (SELECT name FROM public.wallets WHERE id=wallet_a)
       IS DISTINCT FROM 'phase15 after cancellation' THEN
    RAISE EXCEPTION 'phase15 a cancelled operation still changed financial records';
  END IF;

  -- If commit won the race, a later cancellation must NOT rewrite status.
  outcome := public.restore_user_backup_once(snapshot, op_done);
  IF outcome->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'phase15 seed commit failed';
  END IF;
  outcome := public.cancel_restore_operation(op_done);
  IF outcome->>'status' IS DISTINCT FROM 'committed'
     OR public.get_restore_operation_status(op_done)->>'status'
       IS DISTINCT FROM 'committed'
     OR (SELECT operation_status FROM rasd_internal.restore_operation_journal
         WHERE user_id=owner_a AND operation_id=op_done) IS DISTINCT FROM 'committed' THEN
    RAISE EXCEPTION 'phase15 committed operation was incorrectly cancelled';
  END IF;

  -- A second user cannot see or cancel A's operation; composite owner scope.
  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  IF public.get_restore_operation_status(op_cancel)->>'status' IS DISTINCT FROM 'not_found' THEN
    RAISE EXCEPTION 'phase15 cancellation leaked across accounts';
  END IF;
  outcome := public.cancel_restore_operation(op_cancel);
  IF outcome->>'status' IS DISTINCT FROM 'cancelled'
     OR (SELECT count(*) FROM rasd_internal.restore_operation_journal
         WHERE operation_id=op_cancel) <> 2 THEN
    RAISE EXCEPTION 'phase15 account isolation for cancel tombstone failed';
  END IF;

  -- Null operation ID and missing auth must not create a tombstone.
  failure_code := NULL;
  BEGIN
    PERFORM public.cancel_restore_operation(NULL);
  EXCEPTION WHEN OTHERS THEN
    failure_code := SQLSTATE;
  END;
  IF failure_code IS DISTINCT FROM '22023' THEN
    RAISE EXCEPTION 'phase15 accepted a null UUID';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  failure_code := NULL;
  BEGIN
    PERFORM public.cancel_restore_operation(op_unknown);
  EXCEPTION WHEN OTHERS THEN
    failure_code := SQLSTATE;
  END;
  IF failure_code IS NULL THEN
    RAISE EXCEPTION 'phase15 unauthenticated cancellation succeeded';
  END IF;

  IF has_table_privilege('authenticated',
      'rasd_internal.restore_operation_journal', 'INSERT') THEN
    RAISE EXCEPTION 'phase15 journal became directly writable';
  END IF;
END;
$test$;
ROLLBACK;
