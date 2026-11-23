# Rasd Phase 15 — prevent delayed restore after a missing response

## Financial risk addressed

Phase 14 introduced UUID-based idempotency and a durable local restore hold. However, a `not_found` lookup alone **does not fence a delayed HTTP request**. A user could acknowledge the missing record, restore a newer snapshot, and then have the delayed old restore overwrite that newer data.

## Atomic server cancellation

Migration `20261123010000_restore_operation_cancellation_fence.sql` extends the existing private `rasd_internal.restore_operation_journal` with a permanent `operation_status` of `committed` or `cancelled`. Existing entries default to `committed`. A cancellation entry records a reserved UUID with a non-backup all-zero fingerprint sentinel. It contains **no financial data**.

The public `cancel_restore_operation(p_operation_id uuid)` endpoint acquires the **same account-scoped PostgreSQL transaction advisory lock** as `restore_user_backup_once`. When an operation has already committed, cancellation returns `committed` and cannot undo it. Otherwise it inserts an irreversible `cancelled` tombstone; a late arriving `restore_user_backup_once` with that UUID raises an error *before* modifying accounts. The status API also reports `cancelled`. Account identity comes from `auth.uid()`, and journal storage stays in the unexposed internal schema.

A cancellation never deletes a backup file, changes ledger records, or reverses a committed restore. Tombstones must **not expire** while an old HTTP request might still arrive.

## Android/web recovery behavior

1. After a lost response, the existing local hold prevents another destructive request.
2. When the status RPC says `committed`, clear the hold and refresh the active account and native reminders.
3. When the status RPC says `cancelled`, clear the hold: delayed calls with that same UUID can no longer write.
4. When it says `not_found`, **do not** allow user acknowledgment to clear the hold. A cancellation action is offered, with a typed confirmation `إلغاء الاستعادة`, and can release the hold only if the server responds `cancelled`. If the server returns `committed`, reconcile committed data instead.
5. If cancellation or status checking fails, or authentication changes, keep the hold. A missing `cancel_restore_operation` RPC during staggered deployments is a blocker, not a reason to bypass safety.
6. Old legacy v2 restore requests without an operation UUID retain the phase-13 manual review path; server fencing cannot protect requests without an ID.

## Release and acceptance

- Apply phase 14 migration **before** this additive phase 15 migration to the correct Supabase environment. Repository merge does not publish SQL to production by itself.
- Verify that the hosted SSR frontend published by Lovable includes the new UI. Android's current hosted HTTPS WebView is not equivalent to a fully offline packaged application.
- Run disposable SQL tests (early cancellation, idempotent cancellation, late arrival rejection, commit-wins race, role isolation, null UUID, unauthenticated access).
- Validate on physical Android with **synthetic records and a disposable account**, including process restart and delayed request simulation, before treating this as production acceptance.
- Do not automatically retry destructive requests. No real customer financial data or Google OAuth is needed for these tests.

**Limit:** This fences a specific UUID only. Independently generated UUIDs from two devices represent separate restores and are serialized but not automatically deduplicated by content. Legacy endpoints also remain available for old clients until a separate, carefully staged retirement.
