-- Phase 15: close the delayed-request gap after "not_found" status.
-- An old in-flight REST request may arrive *after* a successful status query.
-- Cancellation acquires the SAME per-account transaction advisory lock as
-- restore_user_backup_once, then stores an irreversible cancellation tombstone.
-- No financial rows are touched merely by installing this migration.
--
-- Run AFTER 20261123000000_restore_operation_idempotency.sql.

ALTER TABLE rasd_internal.restore_operation_journal
  ADD COLUMN operation_status text NOT NULL DEFAULT 'committed'
    CHECK (operation_status IN ('committed', 'cancelled'));

-- The cancellation sentinel is not the fingerprint of a backup. Never delete
-- tombstones automatically, because that would re-enable stale restore IDs.
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
  v_state text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT backup_sha256, committed_at, operation_status INTO v_hash, v_at, v_state
  FROM rasd_internal.restore_operation_journal
  WHERE user_id = v_uid AND operation_id = p_operation_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('backup_sha256', v_hash, 'committed_at', v_at, 'operation_status', v_state);
END;
$function$;

CREATE OR REPLACE FUNCTION rasd_internal.record_restore_cancellation(p_operation_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rasd_internal, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_when timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  -- This INSERT happens only after the account advisory transaction lock
  -- and a fresh status lookup in public.cancel_restore_operation.
  INSERT INTO rasd_internal.restore_operation_journal
    (user_id, operation_id, backup_sha256, operation_status)
  VALUES (v_uid, p_operation_id, repeat('0', 64), 'cancelled')
  RETURNING committed_at INTO v_when;
  RETURN v_when;
END;
$function$;

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
    IF v_previous->>'operation_status' = 'cancelled' THEN
      RAISE EXCEPTION 'Restore operation permanently cancelled' USING ERRCODE = 'P0001';
    END IF;
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
  IF v_previous->>'operation_status' = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'cancelled', 'operation_id', p_operation_id);
  END IF;

  RETURN jsonb_build_object(
    'status', 'committed', 'operation_id', p_operation_id,
    'format', 'rasd-backup', 'version', 2,
    'committed_at', v_previous->>'committed_at'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_restore_operation(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_previous jsonb;
  v_cancelled_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'Restore operation id is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize with restore_user_backup_once: if a restore already committed,
  -- this call reports "committed" rather than cancelling it. Otherwise the
  -- tombstone is authoritative BEFORE any delayed same-UUID RPC can execute.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 14014));
  v_previous := rasd_internal.lookup_restore_commit(p_operation_id);

  IF v_previous IS NOT NULL THEN
    IF v_previous->>'operation_status' = 'cancelled' THEN
      RETURN jsonb_build_object(
        'status', 'cancelled', 'operation_id', p_operation_id
      );
    END IF;
    RETURN jsonb_build_object(
      'status', 'committed', 'operation_id', p_operation_id,
      'format', 'rasd-backup', 'version', 2,
      'committed_at', v_previous->>'committed_at'
    );
  END IF;

  v_cancelled_at := rasd_internal.record_restore_cancellation(p_operation_id);
  RETURN jsonb_build_object(
    'status', 'cancelled',
    'operation_id', p_operation_id,
    'cancelled_at', v_cancelled_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION rasd_internal.record_restore_cancellation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rasd_internal.record_restore_cancellation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_restore_operation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_restore_operation(uuid) TO authenticated;
