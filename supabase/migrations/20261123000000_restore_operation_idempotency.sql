-- Phase 14: server-side idempotency for destructive v2 backup restores.
-- Apply database migration BEFORE enabling the new client RPC.
-- No financial rows are touched by installing this migration.

CREATE TABLE public.restore_operation_journal (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  backup_sha256 text NOT NULL CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, operation_id)
);

ALTER TABLE public.restore_operation_journal ENABLE ROW LEVEL SECURITY;

-- Authenticated calls use SECURITY INVOKER, retaining RLS in the existing
-- restore_user_backup(jsonb) implementation. Users cannot read other accounts'
-- journal entries, and UPDATE/DELETE are not granted.
CREATE POLICY restore_op_read_own
ON public.restore_operation_journal
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY restore_op_insert_own
ON public.restore_operation_journal
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.restore_operation_journal FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.restore_operation_journal TO authenticated;

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
  v_prior_fingerprint text;
  v_prior_time timestamptz;
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

  -- Serialize restore calls for this account across devices/sessions. The same
  -- lock is used by the status RPC. This only covers clients using the new API.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 14014));

  -- Canonical JSONB text ensures key order cannot defeat replay detection.
  v_fingerprint := encode(sha256(convert_to(p_backup::text, 'UTF8')), 'hex');

  SELECT j.backup_sha256, j.committed_at
    INTO v_prior_fingerprint, v_prior_time
  FROM public.restore_operation_journal AS j
  WHERE j.user_id = v_uid AND j.operation_id = p_operation_id;

  IF FOUND THEN
    IF v_prior_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Restore operation id already used for different backup'
        USING ERRCODE = '22023';
    END IF;

    -- Duplicate request returns the original SQL result WITHOUT applying
    -- another destructive restore, even if current records changed since.
    RETURN jsonb_build_object(
      'ok', true, 'format', 'rasd-backup', 'version', 2,
      'operation_id', p_operation_id,
      'restored_at', v_prior_time, 'replayed', true
    );
  END IF;

  -- Existing v2 SQL validation + transaction-scoped deletions/inserts.
  -- The journal INSERT and restore share this very same PostgreSQL transaction.
  -- Any exception rolls back BOTH the financial changes and the journal row.
  v_result := public.restore_user_backup(p_backup);

  IF v_result->>'ok' IS DISTINCT FROM 'true'
     OR v_result->>'format' IS DISTINCT FROM 'rasd-backup'
     OR v_result->>'version' IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'Restore returned an invalid commit marker'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.restore_operation_journal
    (user_id, operation_id, backup_sha256)
  VALUES (v_uid, p_operation_id, v_fingerprint)
  RETURNING committed_at INTO v_prior_time;

  RETURN v_result || jsonb_build_object(
    'operation_id', p_operation_id,
    'restored_at', v_prior_time,
    'replayed', false
  );
END;
$function$;

-- This query does not contain financial contents or a password.
-- It waits behind an in-flight RESTORE from the new API for the same account;
-- "not_found" is still NOT proof that a request was never sent/never started.
CREATE OR REPLACE FUNCTION public.get_restore_operation_status(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_committed_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'Restore operation id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 14014));

  SELECT committed_at INTO v_committed_at
  FROM public.restore_operation_journal
  WHERE user_id = v_uid AND operation_id = p_operation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'operation_id', p_operation_id);
  END IF;

  RETURN jsonb_build_object(
    'status', 'committed', 'operation_id', p_operation_id,
    'format', 'rasd-backup', 'version', 2, 'committed_at', v_committed_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_user_backup_once(jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_restore_operation_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_backup_once(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_restore_operation_status(uuid) TO authenticated;

-- Legacy restore_user_backup(jsonb) is not revoked here because old hosted
-- Android/web clients still use it. Roll out the new RPC to ALL clients, then
-- retire the legacy endpoint in a separately tested migration. The journal
-- cannot deduplicate requests that bypass this new function.
