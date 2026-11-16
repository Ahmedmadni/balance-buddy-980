# رصد — Android release and login acceptance checklist

## Architecture
- Package: `app.lovable.rasd`
- Production: `https://balance-buddy-980.lovable.app` (Capacitor-hosted WebView)
- Android OAuth: Supabase Google PKCE in a system Custom Tab, callback `app.lovable.rasd://auth/callback`.
- Web OAuth: existing Lovable managed browser flow, unchanged.

## One-time authentication configuration (required)
1. Ensure **Google** is enabled for the Supabase Auth project underlying this app. A Lovable *broker-only* Google setup is not sufficient for the native Supabase OAuth path; configure compatible Google OAuth credentials/provider if needed.
2. Add exactly `app.lovable.rasd://auth/callback` to Auth → URL Configuration → Redirect URLs in the backend.
3. Keep the website's HTTPS URL in the same allow list so web login remains operational.
4. Do **not** add the custom scheme to Google's OAuth **Authorized redirect URIs**: Google redirects to the Supabase callback, while Supabase then redirects to the Android scheme.
5. Never embed provider secrets or service-role keys into Android JS.
6. Verify signing key and Android package name before distribution.

## Build a testable Android APK
```bash
bun install
bun run android:debug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```
The Android setup script creates the native directory if absent, then injects and validates the callback intent filter in AndroidManifest.xml. The debug build uses the **published** URL (not the Lovable editor preview).
Production signed release requires your own Android signing configuration:
```bash
bun run android:apk
```

## Must-pass device tests
- Sign in with Google on a fresh install; after consent, Chrome Custom Tab returns to app and dashboard, with a valid Supabase session.
- Cold start and warm start both accept the callback once. Cancel and deny Google consent without trapping the user.
- Force-stop and relaunch: valid session restores; signing out returns to /auth and clears protected UI.
- Test navigation and accessibility at 320px, 360px, 393px, 430px and tablet widths in Arabic RTL, both light and dark.
- Verify report export and full backup download using Android Downloads / Files; do not accept a toast as proof of file creation.
- Check debt/payments, zero percent asset ownership, multi-currency zakat, reporting across more than 1000 records and month-end dates.
- Test offline/error screens; never render balances as zero when backend requests fail.
- Verify actual Android notifications separately. Current code does **not** guarantee background reminders while the app is closed.

## Release blockers outside source code
- Backend OAuth provider/redirect configuration is not version-controlled here.
- No actual on-device Google login or signed APK smoke test is attested by source review.
- The published remote WebView requires network connectivity; do not market this build as fully offline.

## Android phase 2: non-login changes (2026-11-16)
- **Export**: Reports and recommended backup v2 use `@capacitor/filesystem` (Cache) and `@capacitor/share`. This opens the Android share sheet. A file is not safely backed up until the user explicitly saves it in Files/Drive and verifies it there.
- **Encrypted backup**: Recommended v2 downloads are wrapped with AES-256-GCM and a PBKDF2-SHA256 key derived from an independent 12+ character backup passphrase. The passphrase is not stored. Wrong password and tampered files fail closed. Retain the passphrase separately from the device.
- **Restore**: Encrypted backups can be decrypted and restored through the existing server-side v2 restore RPC. Legacy unencrypted v2 imports remain available with a visible warning, but legacy backup-v1 UI is disabled on Android.
- **Local reminders**: Opt-in reminders are scheduled for upcoming due dates via `@capacitor/local-notifications` on application startup/resume and Settings save. Android notification permission is requested only via an explicit Settings action. Display time and background reliability depend on OS settings and battery optimization. Push, email, SMS and WhatsApp providers remain unimplemented.
- **PIN**: Incorrect PIN attempts are delayed with an exponential local UI lockout; this is **not** Keystore-backed brute-force protection or data-at-rest encryption.
- **App lifecycle**: Android back gesture, native app minimization, offline status banner, privacy blur for background activity, and small-screen input/layout adjustments.
- **Validation**: CI checks typecheck, unit tests including encryption/tampering, lint, browser layout at 320–430px, database regressions, native debug APK compile and basic emulator launch **without Google sign-in**.

## Important limitations
- Google OAuth settings and on-device login remain deliberately deferred for the final login phase.
- Background reminders are scheduled when the app was online and running, not via a continuous offline scheduler. Long-term reliability on different Android vendors requires device validation.
- The application still uses a remotely hosted WebView. It **does not** support offline financial mutations or offline-first synchronization. If network access is interrupted, do not assume a financial write succeeded.
- The new share sheet cannot attest the user's destination or verify that a separate backup copy exists. Explicitly verify the exported file.
- A plain Excel/CSV report saved by the user is not encrypted just because the separate JSON backup format is encrypted. Avoid sharing sensitive exports insecurely.

## Android phase 3: reminder correctness and destructive-action safeguards
- Financial **date-only** due dates are treated as local calendar dates; derived debt, recurring expense, asset and zakat reminders retain all-day semantics even if stored as an ISO timestamp.
- Events with explicit time keep their time; quiet hours move non-critical notifications **forward** to the next permitted local time. Do not imply exact delivery on Android versions restricting alarm scheduling.
- New alarms are scheduled before obsolete alarms are cancelled, reducing the risk of losing pre-existing reminders when a native schedule request fails.
- Overdue obligations generate at most one generic, privacy-safe daily summary when the user has opted into local reminders and opens/resumes the app. It contains no names or monetary amounts.
- Import of financial backup files is limited to 50 MiB to reduce out-of-memory failures in Android WebView. Destructive v2 restore requires typing **استعادة** to confirm.
- MainActivity enables Android's `FLAG_SECURE` on `onPause` to reduce exposure of recent-app snapshots and clears it on `onResume` so the owner may still capture reports while actively using the app. This is **not** end-to-end screen-recording prevention.
- The above is release-code verification, not evidence that every Android manufacturer's background notification policy behaves identically. Real-device validation is still required.
- As explicitly requested, Google login testing is deliberately the final phase and was **not** included in phase 3.
