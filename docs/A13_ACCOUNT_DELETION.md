# A13 — Secure account deletion

`supabase/functions/delete-account/index.ts` is the only component allowed to
perform permanent account deletion. The browser sends the active JWT, the
user's password, the exact Arabic confirmation phrase, and a request ID. The
function then:

1. validates the request origin when an allow-list is configured;
2. validates the JWT with Supabase Auth;
3. reauthenticates the same email/password user, or requires an explicit OAuth
   login completed within the previous five minutes;
4. deletes attachment objects, including orphaned objects under the user's
   Storage prefix;
5. deletes user-owned rows leaf-first so retries are safe;
6. deletes the profile and finally the Supabase Auth user;
7. writes structured function logs using a hashed subject, never the raw user
   ID, email, password, JWT, or service-role key.

## Required deployment configuration

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Set these additional
secrets before deployment:

```sh
supabase secrets set \
  ACCOUNT_DELETION_ALLOWED_ORIGINS=https://your-real-domain.example \
  ACCOUNT_DELETION_AUDIT_SALT=replace-with-a-long-random-secret
```

Multiple allowed origins are comma-separated. An empty allow-list is intended
only for local development and permits all origins; production must set it.

Deploy only after linking the CLI to the separate test/staging project:

```sh
supabase functions deploy delete-account
```

## Test protocol (never production)

1. Create a disposable user in a separate Supabase test project.
2. Add at least one row to every user-owned table and upload nested and orphaned
   files beneath `attachments/<user-id>/...`.
3. Export the deletion package in the UI.
4. Confirm that the wrong password and wrong confirmation phrase are rejected
   without deleting data.
5. Submit the correct password and confirmation phrase.
6. Verify that Auth login fails, no user rows remain, the profile is gone, and
   no Storage objects remain below the user's prefix.
7. Repeat with an intentionally interrupted request before Auth deletion to
   verify a retry safely completes.

OAuth reauthentication forces the provider login prompt and returns the user to
the deletion dialog. The Edge Function checks Supabase Auth's server-maintained
`last_sign_in_at` timestamp; refreshing an access token is not accepted as a
fresh sign-in.

No database migration is required by this implementation.


## Encrypted cloud backup cleanup (PR #16, October 2026)

When the private `rasd-private-backups` bucket has been enabled, the Edge Function also enumerates
and removes every object beneath the authenticated user's prefix in that bucket **before deleting
Auth**, including orphan backup objects. An earlier deployment without the bucket is supported
by ignoring only its expected bucket-not-found response.

Add this to the staging deletion test: create several encrypted cloud backups for disposable user A,
keep a separate backup for user B, delete A via the UI, then confirm A's entire Storage prefix
is empty and B's remains untouched. Also test a retry after an interrupted deletion and the
pre-bucket deployment path. This function change has not been deployed or run against live data.
