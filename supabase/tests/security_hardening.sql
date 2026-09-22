BEGIN;

DO $$
DECLARE
  exposed_table text;
  signature text;
BEGIN
  SELECT c.relname
    INTO exposed_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity
  ORDER BY c.relname
  LIMIT 1;

  IF exposed_table IS NOT NULL THEN
    RAISE EXCEPTION 'public table % does not have RLS enabled', exposed_table;
  END IF;

  FOREACH signature IN ARRAY ARRAY[
    'public.export_user_backup()',
    'public.restore_user_backup(jsonb)',
    'public.mutate_person_ledger(text,uuid,jsonb)',
    'public.mutate_investment_transaction(text,uuid,jsonb)',
    'public.mutate_wallet_transfer(text,uuid,jsonb)'
  ] LOOP
    IF to_regprocedure(signature) IS NULL THEN
      RAISE EXCEPTION 'required RPC is missing: %', signature;
    END IF;

    IF has_function_privilege('anon', to_regprocedure(signature), 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can execute protected RPC: %', signature;
    END IF;

    IF NOT has_function_privilege('authenticated', to_regprocedure(signature), 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated role cannot execute user RPC: %', signature;
    END IF;
  END LOOP;

  FOREACH signature IN ARRAY ARRAY[
    'public._sync_tx_from_wallet_tx()',
    'public._sync_tx_from_expense()',
    'public._sync_tx_from_person_ledger()',
    'public._sync_tx_from_investment_tx()'
  ] LOOP
    IF to_regprocedure(signature) IS NULL THEN
      RAISE EXCEPTION 'internal trigger function is missing: %', signature;
    END IF;

    IF has_function_privilege('anon', to_regprocedure(signature), 'EXECUTE')
      OR has_function_privilege('authenticated', to_regprocedure(signature), 'EXECUTE') THEN
      RAISE EXCEPTION 'client role can execute internal trigger function: %', signature;
    END IF;
  END LOOP;

  IF has_table_privilege('anon', 'public.transactions', 'INSERT,UPDATE,DELETE,TRUNCATE')
    OR has_table_privilege('authenticated', 'public.transactions', 'INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'a client role can mutate the derived transactions table';
  END IF;
END
$$;

ROLLBACK;
