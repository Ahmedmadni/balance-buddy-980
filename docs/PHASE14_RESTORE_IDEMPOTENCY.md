# Phase 14 — Server-acknowledged v2 restore idempotency (staged deployment)

## Why this is required

The phase-13 local safety journal only blocks a replay on the **same WebView/browser storage**. A second device or lost device storage can send the same restore again. This migration adds an explicit operation UUID and a commit journal **in the same database transaction as the destructive v2 restore**.

## New RPC contracts

- `restore_user_backup_once(p_backup jsonb, p_operation_id uuid)`: per-account advisory transaction lock; SHA-256 of normalized JSONB; calls existing `restore_user_backup(jsonb)` only on a **new** UUID. Returns normal success marker plus `operation_id` and `replayed=false`; repeat same UUID and matching backup returns `replayed=true` **without touching financial rows**. Same UUID with a different payload raises SQLSTATE 22023. Exceptions roll back both restored rows and journal entry.
- `get_restore_operation_status(p_operation_id uuid)`: authenticated per-account lookup, serialized behind ongoing new-style restores. Returns `status=committed` with timestamp or `status=not_found` without finance content. A missing row is **not proof** that an earlier network request cannot still arrive; do not automatically replay.
- `restore_operation_journal`: row-level ownership restrictions, no UPDATE/DELETE grant; records operation ID, user ID, SHA-256, timestamp. No backup contents or password. Journal rows are intentionally retained; automatic expiry would remove replay protection.

## Rollout / operational hold

1. Merge and apply migration `20261123000000_restore_operation_idempotency.sql` to the **intended backend** using an approved migration procedure. Repository merge alone does NOT prove that the hosted Supabase database has received it. Test on a disposable Supabase database first.
2. Only after confirming `get_restore_operation_status` and `restore_user_backup_once` are reachable, switch the client to send and durably retain one UUID **per restore attempt** and use the new RPC. Never generate a new UUID when retrying the same attempt.
3. While the hosted Android/web clients still call legacy `restore_user_backup`, those requests bypass the server journal. Do not revoke the old RPC prematurely: live clients would break. Retire legacy access only after a separate backwards-compatibility review and rollout.
4. Only then provide UI status reconciliation after a lost response. An unknown/not-found status must preserve the restore hold and never trigger an automatic retry.
5. Real-device and cross-device acceptance with disposable accounts is required. No production financial data should be restored during CI or for demonstration.

**Security boundary:** The new wrapper remains `SECURITY INVOKER` so the existing restore function runs with its original RLS semantics. The journal table grants authenticated owners INSERT/SELECT under RLS; users cannot modify other accounts' entries, but someone deliberately making raw authenticated SQL/REST calls can insert their own false journal rows. To make the journal tamper-proof against hostile authenticated callers, a later private-schema, security-reviewed journaling authority would be required. This stage is designed to prevent accidental duplicate *app RPCs*, not to attest against a malicious account owner.
