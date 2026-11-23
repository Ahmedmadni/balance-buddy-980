# Phase 14 — Server-acknowledged v2 restore idempotency (staged deployment)

## Why this is required

The phase-13 local safety journal only blocks a replay on the **same WebView/browser storage**. A second device or lost device storage can send the same restore again. This migration adds an explicit operation UUID and a commit journal **in the same database transaction as the destructive v2 restore**.

## New RPC contracts

- `restore_user_backup_once(p_backup jsonb, p_operation_id uuid)`: per-account advisory transaction lock; SHA-256 of normalized JSONB; calls existing `restore_user_backup(jsonb)` only on a **new** UUID. Returns normal success marker plus `operation_id` and `replayed=false`; repeat same UUID and matching backup returns `replayed=true` **without touching financial rows**. Same UUID with a different payload raises SQLSTATE 22023. Exceptions roll back both restored rows and journal entry.
- `get_restore_operation_status(p_operation_id uuid)`: authenticated per-account lookup, serialized behind ongoing new-style restores. Returns `status=committed` with timestamp or `status=not_found` without finance content. A missing row is **not proof** that an earlier network request cannot still arrive; do not automatically replay.
- `rasd_internal.restore_operation_journal`: private commit journal hidden from PostgREST and without authenticated table grants. The only writable/readable interfaces are tightly scoped `rasd_internal` SECURITY DEFINER helpers that filter by `auth.uid()`; the actual financial restore remains SECURITY INVOKER. It stores operation ID, owner, SHA-256 and timestamp, never financial rows or passwords. No automatic expiry.

## Rollout / operational hold

1. Merge and apply migration `20261123000000_restore_operation_idempotency.sql` to the **intended backend** using an approved migration procedure. Repository merge alone does NOT prove that the hosted Supabase database has received it. Test on a disposable Supabase database first.
2. The updated client probes `get_restore_operation_status` with a fresh UUID before any destructive RPC. If the new RPC responds with an explicit matching `not_found`, it uses `restore_user_backup_once` and stores the UUID with the local hold. Only the specific `PGRST202` (RPC not installed) response selects the legacy RPC; any other probe error blocks restore without sending data. This preserves backwards compatibility while the migration is pending.
3. While the hosted Android/web clients still call legacy `restore_user_backup`, those requests bypass the server journal. Do not revoke the old RPC prematurely: live clients would break. Retire legacy access only after a separate backwards-compatibility review and rollout.
4. If a new-style request is unconfirmed, its UUID remains with the local hold across WebView reloads. The recovery UI queries the server status: `committed` can clear the hold and refresh views/reminders; `not_found` now requires a server-confirmed cancellation fence (phase 15, `cancel_restore_operation`); manual acknowledgment cannot release a UUID-backed hold, and unknown/error keeps it blocked. No automatic destructive retry.
5. Real-device and cross-device acceptance with disposable accounts is required. No production financial data should be restored during CI or for demonstration.

**Security boundary:** The public wrapper remains `SECURITY INVOKER` so the original restore runs with its existing RLS. Commit entries live in an unexposed `rasd_internal` schema; authenticated roles have no direct table grants. Narrow SECURITY DEFINER helper functions require `auth.uid()` and scope every row. Do not expose `rasd_internal` through Supabase's API schemas. Authorized callers that can execute arbitrary SQL as the authenticated DB role could still invoke the private helper functions directly, so this is not a cryptographic attestation against privileged malicious callers.

## Client acceptance and conservative recovery

- One UUID must be durable before each new `restore_user_backup_once` call, including when the app crashes while the HTTP request is in flight.
- A success marker with the wrong operation UUID must NOT be accepted as a committed response.
- Reopening Android after losing the response must show the held UUID and a server status check action.
- For a `committed` status, only the same authenticated account can release its hold; native alarms and active views are then reconciled.
- For `not_found`, keep the hold and explicitly warn that a delayed request can still arrive. Never manually release a UUID-backed hold on `not_found`: require the phase-15 cancellation RPC to confirm `cancelled`, or a later status check to confirm `committed`.
- Never refresh native reminders under a different account if the login changes before the RPC response.
- If the backend is not yet upgraded, a definite `PGRST202` error permits legacy restore under the phase-13 local hold; older no-UUID holds still require manual review. Other capability-check errors fail closed. Once the server RPCs become available, the new path is selected automatically.

**Scope of exactly-once protection:** It only deduplicates requests carrying the **same operation UUID**. Two independently generated UUIDs (including two devices independently starting a restore of the same archive) are separate destructive operations, serialized by account but not deduplicated. The client must preserve the same UUID during error recovery; a separate future design would be needed to refuse unrelated simultaneous restore intents.

**Phase 15 supersedes earlier manual-clearing instructions for server-UUID operations.** See [PHASE15_RESTORE_CANCELLATION_FENCE.md](PHASE15_RESTORE_CANCELLATION_FENCE.md) for the permanent cancellation tombstone and safe recovery instructions.
