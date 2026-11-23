-- Phase 14: server-side idempotency for destructive v2 backup restores.
-- Apply database migration BEFORE enabling the new client RPC.
-- No financial rows are touched by installing this migration.

-- Keep authoritative commit markers out of all REST-exposed schemas.
-- Supabase must NOT add rasd_internal to its exposed API schemas.
CREATE SCHEMA IF NOT EXISTS rasd_internal;
REVOKE ALL ON SCHEMA rasd_internal FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA rasd_internal TO authenticated;

CREATE TABLE rasd_internal.restore_operation_journal (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  backup_sha256 text NOT NULL CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, operation_id)
);

-- The journal is not directly accessible to authenticated app sessions.
-- SECURITY DEFINER helper functions *only* handle journal reads/writes and
-- independently filter by auth.uid(); the destructive restore itself retains
-- SECURITY INVOKER and therefore its existing table RLS semantics.
REVOKE ALL ON rasd_internal.restore_operation_journal FROM PUBLIC, anon, authenticated;
ALTER TABLE rasd_internal.restore_operation_journal ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION rasd_internal.lookup_restore_commit(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rasd_internal, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  v_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT backup_sha256, committed_at INTO v_hash, v_at
  FROM rasd_internal.restore_operation_journal
  WHERE user_id = v_uid AND operation_id = p_operation_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('backup_sha256', v_hash, 'committed_at', v_at);
END;
$function$;

CREATE OR REPLACE FUNCTION rasd_internal.record_restore_commit(
  p_operation_id uuid,
  p_backup_sha256 text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rasd_internal, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  INSERT INTO rasd_internal.restore_operation_journal
    (user_id, operation_id, backup_sha256)
  VALUES (v_uid, p_operation_id, p_backup_sha256)
  RETURNING committed_at INTO v_at;
  RETURN v_at;
END;
$function$;

REVOKE ALL ON FUNCTION rasd_internal.lookup_restore_commit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rasd_internal.record_restore_commit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rasd_internal.lookup_restore_commit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rasd_internal.record_restore_commit(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_user_backup_once(
  p_backup jsonb,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fingerprint text;
  v_previous jsonb;
  v_committed_at timestamptz;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'Restore operation id is required' USING ERRCODE = '22023';
  END IF;
  IF p_backup IS NULL THEN
    RAISE EXCEPTION 'Backup payload is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize new-style restores for one account across devices and tabs.
  -- The same lock is used by the status query. The legacy RPC bypasses it.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 14014));
  v_fingerprint := encode(sha256(convert_to(p_backup::text, 'UTF8')), 'hex');

  v_previous := rasd_internal.lookup_restore_commit(p_operation_id);
  IF v_previous IS NOT NULL THEN
    IF v_previous->>'backup_sha256' IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Restore operation id already used for different backup'
        USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'format', 'rasd-backup', 'version', 2,
      'operation_id', p_operation_id,
      'restored_at', v_previous->>'committed_at', 'replayed', true
    );
  END IF;

  -- SECURITY INVOKER preserves the existing v2 RLS and data validation.
  -- The helper insert below shares the same transaction as all financial
  -- changes. A failure rolls back the journal entry and the entire restore.
  v_result := public.restore_user_backup(p_backup);
  IF v_result->>'ok' IS DISTINCT FROM 'true'
     OR v_result->>'format' IS DISTINCT FROM 'rasd-backup'
     OR v_result->>'version' IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'Restore returned an invalid commit marker'
      USING ERRCODE = 'P0001';
  END IF;

  v_committed_at := rasd_internal.record_restore_commit(p_operation_id, v_fingerprint);
  RETURN v_result || jsonb_build_object(
    'operation_id', p_operation_id,
    'restored_at', v_committed_at, 'replayed', false
  );
END;
$function$;

-- Do NOT auto-retry if status is absent: a previously sent request could
-- still arrive after the query. Confirm account data and wait when uncertain.
CREATE OR REPLACE FUNCTION public.get_restore_operation_status(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_previous jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'Restore operation id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 14014));
  v_previous := rasd_internal.lookup_restore_commit(p_operation_id);
  IF v_previous IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found', 'operation_id', p_operation_id);
  END IF;

  RETURN jsonb_build_object(
    'status', 'committed', 'operation_id', p_operation_id,
    'format', 'rasd-backup', 'version', 2,
    'committed_at', v_previous->>'committed_at'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_user_backup_once(jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_restore_operation_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_backup_once(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_restore_operation_status(uuid) TO authenticated;

-- Legacy restore_user_backup(jsonb) stays callable for old Android clients.
-- Retire it only after all clients migrate to the new RPC.
