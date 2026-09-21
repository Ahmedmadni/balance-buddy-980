-- A06 schema parity: audited production definitions for backup/restore v2.
-- The migration only defines RPCs. It does not invoke restore or modify user data.

CREATE OR REPLACE FUNCTION public.export_user_backup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT jsonb_build_object(
    'format', 'rasd-backup',
    'version', 2,
    'exported_at', now(),

    'profile',
      COALESCE(
        (
          SELECT to_jsonb(p) - 'id'
          FROM public.profiles p
          WHERE p.id = v_uid
          LIMIT 1
        ),
        '{}'::jsonb
      ),

    'data', jsonb_build_object(

      'wallets',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.wallets x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'contacts',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.contacts x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'categories',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.categories x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'projects',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.projects x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'wallet_tx_categories',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.wallet_tx_categories x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'investments',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.investments x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'investment_transactions',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.investment_transactions x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'asset_market_values',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.asset_market_values x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'depreciation_profiles',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.depreciation_profiles x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'expenses',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.expenses x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'expense_allocations',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.expense_allocations x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'recurring_expenses',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.recurring_expenses x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'person_ledger',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.person_ledger x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'wallet_transactions',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.wallet_transactions x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'debts',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.debts x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'debt_payments',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.debt_payments x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'exchange_rates',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.exchange_rates x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'zakat_settings',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.zakat_settings x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        ),

      'zakat_records',
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(x) - 'user_id' ORDER BY x.created_at, x.id)
           FROM public.zakat_records x
           WHERE x.user_id = v_uid),
          '[]'::jsonb
        )

    ),

    'excluded', jsonb_build_object(
      'transactions', 'derived_rebuilt_from_source_tables',
      'attachments', 'metadata_without_storage_file_is_not_a_complete_backup',
      'system_events', 'operational_data_not_in_backup_v2'
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$

CREATE OR REPLACE FUNCTION public.restore_user_backup(p_backup jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb;
  v_profile jsonb;
  v_key text;

  v_required_keys text[] := ARRAY[
    'wallets',
    'contacts',
    'categories',
    'projects',
    'wallet_tx_categories',
    'investments',
    'investment_transactions',
    'asset_market_values',
    'depreciation_profiles',
    'expenses',
    'expense_allocations',
    'recurring_expenses',
    'person_ledger',
    'wallet_transactions',
    'debts',
    'debt_payments',
    'exchange_rates',
    'zakat_settings',
    'zakat_records'
  ];
BEGIN
  -- ==========================================================
  -- 1. Authentication
  -- ==========================================================

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- ==========================================================
  -- 2. Top-level validation BEFORE any DELETE
  -- ==========================================================

  IF p_backup IS NULL
     OR jsonb_typeof(p_backup) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid backup payload';
  END IF;

  IF p_backup->>'format' IS DISTINCT FROM 'rasd-backup' THEN
    RAISE EXCEPTION 'Unsupported backup format';
  END IF;

  IF p_backup->>'version' IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'Unsupported backup version';
  END IF;

  v_data := p_backup->'data';

  IF v_data IS NULL
     OR jsonb_typeof(v_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Backup data object is missing';
  END IF;

  -- transactions is derived and must never be supplied by backup.
  IF v_data ? 'transactions' THEN
    RAISE EXCEPTION 'Derived transactions must not be included';
  END IF;

  IF v_data ? 'attachments' THEN
    RAISE EXCEPTION 'Attachments are not supported by backup v2';
  END IF;

  IF v_data ? 'system_events' THEN
    RAISE EXCEPTION 'System events are not supported by backup v2';
  END IF;

  -- Require all Backup v2 collections.
  FOREACH v_key IN ARRAY v_required_keys
  LOOP
    IF NOT (v_data ? v_key) THEN
      RAISE EXCEPTION 'Backup collection missing: %', v_key;
    END IF;

    IF jsonb_typeof(v_data->v_key) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Backup collection must be an array: %', v_key;
    END IF;
  END LOOP;

  -- Backup payload is never allowed to choose a user.
  FOREACH v_key IN ARRAY v_required_keys
  LOOP
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_data->v_key) AS e(value)
      WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'object'
         OR e.value ? 'user_id'
    ) THEN
      RAISE EXCEPTION
        'Invalid or unsafe row in collection: %',
        v_key;
    END IF;
  END LOOP;

  -- ==========================================================
  -- 3. Profile validation BEFORE destructive phase
  -- ==========================================================

  v_profile := COALESCE(p_backup->'profile', '{}'::jsonb);

  IF jsonb_typeof(v_profile) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid profile object';
  END IF;

  IF v_profile ? 'id' OR v_profile ? 'user_id' THEN
    RAISE EXCEPTION
      'Backup profile contains forbidden identity field';
  END IF;

  -- ==========================================================
  -- 4. PostgreSQL schema/type validation BEFORE DELETE
  -- ==========================================================

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.wallets,
    v_data->'wallets'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.contacts,
    v_data->'contacts'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.categories,
    v_data->'categories'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.projects,
    v_data->'projects'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.wallet_tx_categories,
    v_data->'wallet_tx_categories'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.investments,
    v_data->'investments'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.investment_transactions,
    v_data->'investment_transactions'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.asset_market_values,
    v_data->'asset_market_values'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.depreciation_profiles,
    v_data->'depreciation_profiles'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.expenses,
    v_data->'expenses'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.expense_allocations,
    v_data->'expense_allocations'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.recurring_expenses,
    v_data->'recurring_expenses'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.person_ledger,
    v_data->'person_ledger'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.wallet_transactions,
    v_data->'wallet_transactions'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.debts,
    v_data->'debts'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.debt_payments,
    v_data->'debt_payments'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.exchange_rates,
    v_data->'exchange_rates'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.zakat_settings,
    v_data->'zakat_settings'
  );

  PERFORM 1 FROM jsonb_populate_recordset(
    NULL::public.zakat_records,
    v_data->'zakat_records'
  );

  -- ==========================================================
  -- 5. Reference validation BEFORE DELETE
  -- ==========================================================

  -- investments -> wallets
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'investments') i
    WHERE NULLIF(i->>'wallet_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'wallets') w
        WHERE w->>'id' = i->>'wallet_id'
      )
  ) THEN
    RAISE EXCEPTION
      'Backup contains investment with invalid wallet reference';
  END IF;

  -- investments -> parent investments
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'investments') i
    WHERE NULLIF(i->>'parent_investment_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'investments') p
        WHERE p->>'id' = i->>'parent_investment_id'
      )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid parent investment reference';
  END IF;

  -- investment_transactions -> investment + wallet
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      v_data->'investment_transactions'
    ) t
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_data->'investments') i
      WHERE i->>'id' = t->>'investment_id'
    )
    OR (
      NULLIF(t->>'wallet_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'wallets') w
        WHERE w->>'id' = t->>'wallet_id'
      )
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid investment transaction reference';
  END IF;

  -- expenses -> wallet/category/project
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'expenses') e
    WHERE (
      NULLIF(e->>'wallet_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'wallets') w
        WHERE w->>'id' = e->>'wallet_id'
      )
    )
    OR (
      NULLIF(e->>'category_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'categories') c
        WHERE c->>'id' = e->>'category_id'
      )
    )
    OR (
      NULLIF(e->>'project_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'projects') p
        WHERE p->>'id' = e->>'project_id'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Backup contains invalid expense reference';
  END IF;

  -- person_ledger -> contact/wallet
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'person_ledger') l
    WHERE (
      NULLIF(l->>'contact_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'contacts') c
        WHERE c->>'id' = l->>'contact_id'
      )
    )
    OR (
      NULLIF(l->>'wallet_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'wallets') w
        WHERE w->>'id' = l->>'wallet_id'
      )
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid person ledger reference';
  END IF;

  -- asset_market_values -> investments
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'asset_market_values') a
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_data->'investments') i
      WHERE i->>'id' = a->>'investment_id'
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid asset market value reference';
  END IF;

  -- depreciation_profiles -> investments
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'depreciation_profiles') d
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_data->'investments') i
      WHERE i->>'id' = d->>'investment_id'
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid depreciation profile reference';
  END IF;

  -- expense_allocations -> expenses
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'expense_allocations') a
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_data->'expenses') e
      WHERE e->>'id' = a->>'expense_id'
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid expense allocation reference';
  END IF;

  -- recurring_expenses references
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'recurring_expenses') r
    WHERE (
      NULLIF(r->>'wallet_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_data->'wallets') w
        WHERE w->>'id' = r->>'wallet_id'
      )
    )
    OR (
      NULLIF(r->>'category_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_data->'categories') c
        WHERE c->>'id' = r->>'category_id'
      )
    )
    OR (
      NULLIF(r->>'contact_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_data->'contacts') c
        WHERE c->>'id' = r->>'contact_id'
      )
    )
    OR (
      NULLIF(r->>'project_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_data->'projects') p
        WHERE p->>'id' = r->>'project_id'
      )
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid recurring expense reference';
  END IF;

  -- wallet_transactions references
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'wallet_transactions') t
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_data->'wallets') w
      WHERE w->>'id' = t->>'wallet_id'
    )
    OR (
      NULLIF(t->>'counterparty_wallet_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'wallets') w
        WHERE w->>'id' = t->>'counterparty_wallet_id'
      )
    )
    OR (
      NULLIF(t->>'contact_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'contacts') c
        WHERE c->>'id' = t->>'contact_id'
      )
    )
    OR (
      NULLIF(t->>'category_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          v_data->'wallet_tx_categories'
        ) c
        WHERE c->>'id' = t->>'category_id'
      )
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid wallet transaction reference';
  END IF;

  -- debts -> contacts
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'debts') d
    WHERE NULLIF(d->>'contact_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_data->'contacts') c
        WHERE c->>'id' = d->>'contact_id'
      )
  ) THEN
    RAISE EXCEPTION 'Backup contains invalid debt contact reference';
  END IF;

  -- debt_payments -> debts
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_data->'debt_payments') p
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_data->'debts') d
      WHERE d->>'id' = p->>'debt_id'
    )
  ) THEN
    RAISE EXCEPTION
      'Backup contains invalid debt payment reference';
  END IF;

  -- ==========================================================
  -- 6. Destructive phase
  --
  -- IMPORTANT:
  -- transactions is derived/read-only and is NOT directly
  -- deleted here. Existing source DELETE triggers own its cleanup.
  -- Any exception rolls this whole RPC transaction back.
  -- ==========================================================

  DELETE FROM public.debt_payments
  WHERE user_id = v_uid;

  DELETE FROM public.asset_market_values
  WHERE user_id = v_uid;

  DELETE FROM public.depreciation_profiles
  WHERE user_id = v_uid;

  DELETE FROM public.expense_allocations
  WHERE user_id = v_uid;

  DELETE FROM public.recurring_expenses
  WHERE user_id = v_uid;

  DELETE FROM public.investment_transactions
  WHERE user_id = v_uid;

  DELETE FROM public.person_ledger
  WHERE user_id = v_uid;

  DELETE FROM public.expenses
  WHERE user_id = v_uid;

  DELETE FROM public.wallet_transactions
  WHERE user_id = v_uid;

  DELETE FROM public.debts
  WHERE user_id = v_uid;

  DELETE FROM public.investments
  WHERE user_id = v_uid;

  DELETE FROM public.zakat_records
  WHERE user_id = v_uid;

  DELETE FROM public.zakat_settings
  WHERE user_id = v_uid;

  DELETE FROM public.exchange_rates
  WHERE user_id = v_uid;

  DELETE FROM public.projects
  WHERE user_id = v_uid;

  DELETE FROM public.wallet_tx_categories
  WHERE user_id = v_uid;

  DELETE FROM public.categories
  WHERE user_id = v_uid;

  DELETE FROM public.contacts
  WHERE user_id = v_uid;

  DELETE FROM public.wallets
  WHERE user_id = v_uid;

  -- ==========================================================
  -- 7. Restore independent parents
  -- ==========================================================

  INSERT INTO public.wallets
  SELECT
    r.id,
    v_uid,
    r.name,
    r.type,
    r.currency,
    r.opening_balance,
    r.color,
    r.icon,
    r.created_at,
    r.updated_at,
    r.is_archived
  FROM jsonb_populate_recordset(
    NULL::public.wallets,
    v_data->'wallets'
  ) r;

  INSERT INTO public.contacts
  SELECT
    r.id,
    v_uid,
    r.name,
    r.phone,
    r.notes,
    r.created_at,
    r.email,
    r.tags,
    r.kind
  FROM jsonb_populate_recordset(
    NULL::public.contacts,
    v_data->'contacts'
  ) r;

  INSERT INTO public.categories
  SELECT
    r.id,
    v_uid,
    r.name,
    r.icon,
    r.color,
    r.is_default,
    r.created_at
  FROM jsonb_populate_recordset(
    NULL::public.categories,
    v_data->'categories'
  ) r;

  INSERT INTO public.projects
  SELECT
    r.id,
    v_uid,
    r.name,
    r.description,
    r.budget,
    r.currency,
    r.icon,
    r.color,
    r.status,
    r.created_at
  FROM jsonb_populate_recordset(
    NULL::public.projects,
    v_data->'projects'
  ) r;

  INSERT INTO public.wallet_tx_categories
  SELECT
    r.id,
    v_uid,
    r.name,
    r.kind,
    r.icon,
    r.color,
    r.is_default,
    r.created_at
  FROM jsonb_populate_recordset(
    NULL::public.wallet_tx_categories,
    v_data->'wallet_tx_categories'
  ) r;

  -- ==========================================================
  -- 8. Investments: two-pass self-parent restore
  -- ==========================================================

  INSERT INTO public.investments (
    id,
    user_id,
    name,
    type,
    wallet_id,
    principal,
    current_value,
    ownership_pct,
    currency,
    is_zakatable,
    start_date,
    status,
    notes,
    created_at,
    updated_at,
    subtype,
    meta,
    purpose,
    acquired_at,
    nisab_reached_at,
    asset_kind,
    base_value,
    sold_at,
    sold_amount,
    realized_pnl,
    parent_investment_id
  )
  SELECT
    r.id,
    v_uid,
    r.name,
    r.type,
    r.wallet_id,
    r.principal,
    r.current_value,
    r.ownership_pct,
    r.currency,
    r.is_zakatable,
    r.start_date,
    r.status,
    r.notes,
    r.created_at,
    r.updated_at,
    r.subtype,
    r.meta,
    r.purpose,
    r.acquired_at,
    r.nisab_reached_at,
    r.asset_kind,
    r.base_value,
    r.sold_at,
    r.sold_amount,
    r.realized_pnl,
    NULL
  FROM jsonb_populate_recordset(
    NULL::public.investments,
    v_data->'investments'
  ) r;

  UPDATE public.investments i
  SET parent_investment_id = src.parent_investment_id
  FROM jsonb_populate_recordset(
    NULL::public.investments,
    v_data->'investments'
  ) src
  WHERE i.user_id = v_uid
    AND i.id = src.id
    AND src.parent_investment_id IS NOT NULL;

  -- ==========================================================
  -- 9. Source tables
  --
  -- Source INSERT triggers rebuild derived transactions.
  -- They are NOT assumed to recreate wallet_transactions.
  -- ==========================================================

  INSERT INTO public.expenses
  SELECT
    r.id,
    v_uid,
    r.category_id,
    r.project_id,
    r.amount,
    r.currency,
    r.spent_at,
    r.note,
    r.created_at,
    r.wallet_id,
    r.allocation_kind,
    r.spread_months,
    r.spread_start
  FROM jsonb_populate_recordset(
    NULL::public.expenses,
    v_data->'expenses'
  ) r;

  INSERT INTO public.person_ledger
  SELECT
    r.id,
    v_uid,
    r.contact_name,
    r.kind,
    r.amount,
    r.currency,
    r.happened_at,
    r.notes,
    r.created_at,
    r.contact_id,
    r.due_date,
    r.reminder_enabled,
    r.settled_at,
    r.status,
    r.wallet_id
  FROM jsonb_populate_recordset(
    NULL::public.person_ledger,
    v_data->'person_ledger'
  ) r;

  INSERT INTO public.investment_transactions
  SELECT
    r.id,
    v_uid,
    r.investment_id,
    r.kind,
    r.amount,
    r.currency,
    r.wallet_id,
    r.happened_at,
    r.notes,
    r.created_at,
    r.tx_class,
    r.category_id,
    r.affects_wallet
  FROM jsonb_populate_recordset(
    NULL::public.investment_transactions,
    v_data->'investment_transactions'
  ) r;

  -- IMPORTANT:
  -- Restore ALL backed-up wallet transactions verbatim,
  -- including person_ledger / investment_transaction mirrors.
  INSERT INTO public.wallet_transactions
  SELECT
    r.id,
    v_uid,
    r.wallet_id,
    r.kind,
    r.amount,
    r.currency,
    r.happened_at,
    r.notes,
    r.counterparty_wallet_id,
    r.contact_id,
    r.transfer_group_id,
    r.created_at,
    r.category_id,
    r.source_kind,
    r.source_id
  FROM jsonb_populate_recordset(
    NULL::public.wallet_transactions,
    v_data->'wallet_transactions'
  ) r;

  -- ==========================================================
  -- 10. Child / auxiliary data
  -- ==========================================================

  INSERT INTO public.asset_market_values
  SELECT
    r.id,
    v_uid,
    r.investment_id,
    r.valuation_date,
    r.market_value,
    r.currency,
    r.source,
    r.notes,
    r.created_at,
    r.updated_at
  FROM jsonb_populate_recordset(
    NULL::public.asset_market_values,
    v_data->'asset_market_values'
  ) r;

  INSERT INTO public.depreciation_profiles
  SELECT
    r.id,
    v_uid,
    r.investment_id,
    r.method,
    r.useful_life_months,
    r.salvage_value,
    r.start_date,
    r.is_active,
    r.units_total,
    r.units_consumed,
    r.notes,
    r.created_at,
    r.updated_at
  FROM jsonb_populate_recordset(
    NULL::public.depreciation_profiles,
    v_data->'depreciation_profiles'
  ) r;

  INSERT INTO public.expense_allocations
  SELECT
    r.id,
    r.expense_id,
    v_uid,
    r.period,
    r.amount,
    r.currency,
    r.created_at
  FROM jsonb_populate_recordset(
    NULL::public.expense_allocations,
    v_data->'expense_allocations'
  ) r;

  INSERT INTO public.recurring_expenses
  SELECT
    r.id,
    v_uid,
    r.name,
    r.amount,
    r.currency,
    r.wallet_id,
    r.category_id,
    r.contact_id,
    r.project_id,
    r.frequency,
    r.interval_count,
    r.start_date,
    r.end_date,
    r.next_due,
    r.last_posted_at,
    r.auto_post,
    r.notes,
    r.is_active,
    r.created_at,
    r.updated_at
  FROM jsonb_populate_recordset(
    NULL::public.recurring_expenses,
    v_data->'recurring_expenses'
  ) r;

  INSERT INTO public.debts
  SELECT
    r.id,
    v_uid,
    r.contact_id,
    r.contact_name,
    r.direction,
    r.amount,
    r.currency,
    r.due_date,
    r.status,
    r.notes,
    r.created_at,
    r.updated_at
  FROM jsonb_populate_recordset(
    NULL::public.debts,
    v_data->'debts'
  ) r;

  INSERT INTO public.debt_payments
  SELECT
    r.id,
    r.debt_id,
    v_uid,
    r.amount,
    r.paid_at,
    r.notes,
    r.created_at
  FROM jsonb_populate_recordset(
    NULL::public.debt_payments,
    v_data->'debt_payments'
  ) r;

  INSERT INTO public.exchange_rates
  SELECT
    r.id,
    v_uid,
    r.currency,
    r.rate_to_base,
    r.base_currency,
    r.updated_at,
    r.created_at
  FROM jsonb_populate_recordset(
    NULL::public.exchange_rates,
    v_data->'exchange_rates'
  ) r;

  INSERT INTO public.zakat_settings
  SELECT
    r.id,
    v_uid,
    r.annual_date_type,
    r.annual_date_value,
    r.base_currency,
    r.nisab_method,
    r.gold_jewelry_opinion,
    r.nisab_gold_grams,
    r.nisab_silver_grams,
    r.gold_gram_price,
    r.silver_gram_price,
    r.last_haul_start_date,
    r.first_nisab_reached_at,
    r.created_at,
    r.updated_at
  FROM jsonb_populate_recordset(
    NULL::public.zakat_settings,
    v_data->'zakat_settings'
  ) r;

  INSERT INTO public.zakat_records
  SELECT
    r.id,
    v_uid,
    r.hijri_year,
    r.calculated_at,
    r.base_amount,
    r.rate,
    r.zakat_amount,
    r.currency,
    r.paid,
    r.paid_at,
    r.breakdown,
    r.notes,
    r.created_at,
    r.updated_at,
    r.base_currency,
    r.total_cash,
    r.total_gold,
    r.total_stocks,
    r.total_investments,
    r.total_trade,
    r.nisab_value,
    r.haul_start,
    r.haul_end,
    r.breakdown_json
  FROM jsonb_populate_recordset(
    NULL::public.zakat_records,
    v_data->'zakat_records'
  ) r;

  -- ==========================================================
  -- 11. Profile
  -- Identity is never restored from backup.
  -- ==========================================================

  UPDATE public.profiles
  SET
    display_name = COALESCE(
      v_profile->>'display_name',
      display_name
    ),
    avatar_url = CASE
      WHEN v_profile ? 'avatar_url'
        THEN v_profile->>'avatar_url'
      ELSE avatar_url
    END,
    default_currency = COALESCE(
      v_profile->>'default_currency',
      default_currency
    )
  WHERE id = v_uid;

  -- ==========================================================
  -- 12. Safe result
  -- ==========================================================

  RETURN jsonb_build_object(
    'ok', true,
    'format', 'rasd-backup',
    'version', 2,
    'restored_at', now()
  );
END;
$function$

REVOKE ALL ON FUNCTION public.export_user_backup() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_user_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_user_backup() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_user_backup(jsonb) TO authenticated, service_role;
