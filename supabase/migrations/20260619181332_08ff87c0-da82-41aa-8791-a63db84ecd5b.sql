
-- Tighten RLS: re-create existing policies to target the 'authenticated' role
-- instead of the broader 'public' role. Behavior is unchanged for signed-in
-- users (auth.uid() check still applies), but anonymous requests are now
-- rejected at the role level as a defense-in-depth measure.

DO $$
DECLARE
  r record;
  tables text[] := ARRAY[
    'investments','investment_transactions','zakat_records','attachments',
    'recurring_expenses','person_ledger','wallets','expenses','profiles',
    'contacts','debts','debt_payments','categories','projects',
    'wallet_tx_categories','expense_allocations','wallet_transactions'
  ];
  t text;
  pol_def text;
  cmd_kind text;
  using_expr text;
  check_expr text;
  new_sql text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN
      SELECT polname, polcmd, polroles,
             pg_get_expr(polqual, polrelid) AS qual,
             pg_get_expr(polwithcheck, polrelid) AS wcheck
      FROM pg_policy
      WHERE polrelid = ('public.'||t)::regclass
    LOOP
      -- Only rewrite policies that target the {public} role (oid 0)
      IF NOT (0 = ANY(r.polroles)) THEN
        CONTINUE;
      END IF;

      cmd_kind := CASE r.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END;

      using_expr := COALESCE(r.qual, 'true');
      check_expr := COALESCE(r.wcheck, using_expr);

      EXECUTE format('DROP POLICY %I ON public.%I', r.polname, t);

      IF cmd_kind = 'INSERT' THEN
        new_sql := format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
          r.polname, t, check_expr
        );
      ELSIF cmd_kind = 'SELECT' OR cmd_kind = 'DELETE' THEN
        new_sql := format(
          'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s)',
          r.polname, t, cmd_kind, using_expr
        );
      ELSE
        new_sql := format(
          'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s) WITH CHECK (%s)',
          r.polname, t, cmd_kind, using_expr, check_expr
        );
      END IF;

      EXECUTE new_sql;
    END LOOP;
  END LOOP;
END$$;
