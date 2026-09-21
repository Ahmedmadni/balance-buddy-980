-- A06 backup/restore v2 integration regression. Disposable/local database only.
-- The restore is destructive for the test user, but the outer transaction always rolls back.
BEGIN;

DO $test$
DECLARE
  owner_id uuid := '16000000-0000-0000-0000-000000000001';
  wallet_id uuid := '36000000-0000-0000-0000-000000000001';
  contact_id uuid := '46000000-0000-0000-0000-000000000001';
  wallet_tx_id uuid := '56000000-0000-0000-0000-000000000001';
  backup jsonb;
  result jsonb;
  failure_message text;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at
  ) VALUES (
    owner_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'a06-owner@example.invalid',
    '',
    now()
  );

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  UPDATE public.profiles
  SET display_name = 'A06 original', default_currency = 'USD'
  WHERE id = owner_id;

  INSERT INTO public.wallets (id, user_id, name, currency, opening_balance)
  VALUES (wallet_id, owner_id, 'A06 wallet', 'USD', 125);

  INSERT INTO public.contacts (id, user_id, name, notes)
  VALUES (contact_id, owner_id, 'A06 contact', 'round-trip marker');

  INSERT INTO public.wallet_transactions (
    id, user_id, wallet_id, kind, amount, currency, happened_at, notes
  ) VALUES (
    wallet_tx_id, owner_id, wallet_id, 'deposit', 25, 'USD', '2026-09-01', 'A06 source'
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE source_kind = 'wallet_transactions' AND source_id = wallet_tx_id
  ) THEN
    RAISE EXCEPTION 'A06 setup did not create the derived transaction';
  END IF;

  backup := public.export_user_backup();

  IF backup->>'format' IS DISTINCT FROM 'rasd-backup'
     OR backup->>'version' IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'A06 export returned an invalid format/version';
  END IF;

  IF backup->'data' ? 'transactions' THEN
    RAISE EXCEPTION 'A06 export included the derived transactions collection';
  END IF;

  IF backup->'profile' ? 'id'
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(backup->'data'->'wallets') AS e(value)
       WHERE e.value ? 'user_id'
     ) THEN
    RAISE EXCEPTION 'A06 export leaked restorable identity fields';
  END IF;

  UPDATE public.wallets SET name = 'mutated' WHERE id = wallet_id;
  DELETE FROM public.contacts WHERE id = contact_id;
  UPDATE public.profiles SET display_name = 'mutated', default_currency = 'SAR'
  WHERE id = owner_id;

  result := public.restore_user_backup(backup);

  IF COALESCE((result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'A06 restore did not return ok';
  END IF;

  IF (SELECT name FROM public.wallets WHERE id = wallet_id) IS DISTINCT FROM 'A06 wallet'
     OR (SELECT count(*) FROM public.wallets WHERE id = wallet_id) <> 1 THEN
    RAISE EXCEPTION 'A06 wallet round-trip failed';
  END IF;

  IF (SELECT notes FROM public.contacts WHERE id = contact_id)
       IS DISTINCT FROM 'round-trip marker' THEN
    RAISE EXCEPTION 'A06 contact round-trip failed';
  END IF;

  IF (SELECT display_name FROM public.profiles WHERE id = owner_id)
       IS DISTINCT FROM 'A06 original'
     OR (SELECT default_currency FROM public.profiles WHERE id = owner_id)
       IS DISTINCT FROM 'USD' THEN
    RAISE EXCEPTION 'A06 profile round-trip failed';
  END IF;

  IF (SELECT count(*) FROM public.wallet_transactions WHERE id = wallet_tx_id) <> 1
     OR (SELECT count(*) FROM public.transactions
         WHERE source_kind = 'wallet_transactions' AND source_id = wallet_tx_id) <> 1 THEN
    RAISE EXCEPTION 'A06 source or derived transaction was not rebuilt exactly once';
  END IF;

  failure_message := NULL;
  BEGIN
    PERFORM public.restore_user_backup(
      jsonb_set(backup, '{data,transactions}', '[]'::jsonb)
    );
  EXCEPTION WHEN OTHERS THEN
    failure_message := SQLERRM;
  END;

  IF failure_message IS DISTINCT FROM 'Derived transactions must not be included' THEN
    RAISE EXCEPTION 'A06 unsafe derived payload was not rejected';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE id = wallet_id AND name = 'A06 wallet') THEN
    RAISE EXCEPTION 'A06 rejected payload changed existing data';
  END IF;
END
$test$;

ROLLBACK;
