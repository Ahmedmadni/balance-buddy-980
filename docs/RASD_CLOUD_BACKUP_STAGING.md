# RASD encrypted cloud backups — implementation and operational handoff

**Branch:** `rasd/android-offline-fonts-20261015`, PR #16. **Not deployed to production.**

## What is implemented

- A private Supabase Storage bucket named `rasd-private-backups` created by
  `supabase/migrations/20261015000000_private_encrypted_backups.sql`.
- Policies for authenticated users to list/download/upload/delete **only** object keys whose first folder matches `auth.uid()`.
  No public access, no UPDATE/upsert policy, 25 MiB per object, JSON MIME restriction.
- Users can create a versioned backup on demand in Settings, encrypting `export_user_backup()` v2 in their browser using a
  fresh 16-byte salt, PBKDF2-SHA256 (310k iterations), and AES-256-GCM with a unique 12-byte IV.
  The server receives only the encrypted envelope. Passwords are not persisted or sent to Storage.
- From the same authenticated account, users can list their backups, download the encrypted envelope,
  decrypt/restore via `restore_user_backup(p_backup)` following explicit confirmation, and delete a backup object.
- The v2 validator requires all 19 expected data collections and rejects the derived-transaction collection,
  attachments, and system events. This is stricter than the old shallow header check.
- RLS policy shape has a rollback-only SQL regression test; backup name validation and payload checks have Bun unit tests.

## Important limitations

- This is **Supabase Storage**, not **Google Drive**, and it shares the cloud provider/project with the primary financial database.
  It is **not** an off-provider disaster-recovery copy. Users should download an encrypted local copy to separate storage.
- No automatic scheduled backups or key escrow: requiring a password each time is intentional, so the app cannot silently
  retain plaintext encryption secrets. A future scheduler requires a deliberate key-management architecture.
- The v2 database RPC explicitly excludes attachment objects. No claim of a complete file-and-database disaster-recovery export.
- No native Android file picker and no proven OAuth on Android yet; APK pipeline also remains blocked by GitHub runner jobs.
- The connected Supabase account does **not** expose the `tbwogguzpygnbkjmoeeh` project ref currently named in
  `supabase/config.toml`. No production SQL, storage, or user data was read or changed by this feature work.
- Migrations and new code have not passed GitHub CI in this session. All newly triggered Actions checks failed without
  executing any steps, as also happened for the unchanged `main` documentation commit.

## Deployment — staging first

1. **Verify target project ownership and environment:** ensure the Supabase project ID matches the frontend configuration
   and repository `supabase/config.toml`. Never apply SQL to an unrelated project.
2. After creating a separate staging project and applying earlier Rasd migrations, run the new migration there using the
   Supabase CLI, then run `supabase/tests/private_encrypted_backups.sql` and `supabase/tests/backup_restore_v2.sql`
   against the *disposable staging/local database*.
3. Verify bucket `rasd-private-backups` is private, has a 25 MiB size limit, and only accepts JSON.
4. Log in with **two separate staging users** (A and B). With user A, export a known small dataset,
   encrypt and upload. Confirm A can list and download its own backup; confirm B cannot list, download,
   overwrite, or delete A's object, including when specifying A's full path directly.
5. Download a backup as A, check it contains no plaintext financial data, and verify a wrong password fails.
6. Restore A's backup to A's **staging data only**, verify row counts and balances before and after restoration,
   and verify a tampered file is rejected. Keep another independent backup before any restore test.
7. Verify one user's delete does not delete data, other backups, or the other user's files.
8. Fix the GitHub Actions runner failure, run application/database/browser and Android debug pipelines,
   review security advisories and device QA, and only then merge PR #16.
9. After staging validation, plan production rollout and backup recovery procedures. Do not copy client
   encryption passwords to logs, environment variables, or project secrets.

## Schema notes

- Storage bucket rows may be created through SQL according to Supabase's
  [Creating Buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets) guide.
- Files are uploaded/deleted only via the Storage API, **never** via direct mutation of `storage.objects`.
- Row Level Security applies to private bucket object operations. Check storage operation-aware policy effects
  when adding other policies later: a broad allow policy can undermine a more restrictive owner policy.

## Remaining release blockers

1. CI runner provisioning/billing or GitHub Actions configuration is currently preventing execution;
   the existing PR checks are not evidence of compilation failure or a passing build.
2. Supabase database project ref unavailable through current connected account.
3. Android platform generation, native Google OAuth App Links, APK artifact, installation tests,
   and signed release remain outstanding.
4. Google Drive connector and automatic backup schedule remain outstanding.
5. Attachment backup, native offline application architecture, and end-to-end restore tests remain outstanding.
