# رصد — Android release and login acceptance checklist

## Architecture
- Package: `app.lovable.rasd`
- Production: `https://balance-buddy-980.lovable.app` (Capacitor-hosted WebView)
- Android OAuth: **blocked safely**, not operational. The former direct provider flow returned HTTP 400 on the phone and has been removed. No native browser/session handoff is currently claimed.
- Web OAuth: existing Lovable managed browser flow, unchanged.

## One-time authentication configuration (required)
1. Managed Google web login remains on Lovable's broker. Do not create another account or change the account identity/email to work around native login.
2. Lovable Cloud allows app schemes under **More → Users → Auth settings → Advanced → Redirect URLs**. Inspection on 2026-11-23 found only HTTPS URLs, not `app.lovable.rasd://auth/callback`. Adding that URL alone does **not** supply a supported native broker bridge or a PKCE transaction.
3. The old direct provider route requires Google's own OAuth client ID and client secret, absent according to the phone's `missing OAuth secret` response. If an owner elects to supply their own credentials, enter them only under **More → Users → Auth settings → Sign In Methods → Google**, using the provider callback displayed there in Google Cloud Console. Do not paste credentials in chat or commit them. This configuration is NOT a verified or enabled native fix, and the blocked flow is not automatically re-enabled by it.
4. Keep the existing public HTTPS return URL for web login. A documented native code/verifier/state handoff and real-device verification are still required before enabling Android Google.
5. Never put access/refresh tokens in custom-scheme links, logs, exported files or application source. The dormant intent filter is not an HTTPS verified App Link and another application can claim the same scheme. All native callbacks in this build are rejected without exchanging codes or replacing sessions.
6. Verify signing key and Android package name before distribution. Do not spoof `LovableApp/` or `LovableAppScheme/` user agents: that is the editor app's iframe bridge, not this hosted Capacitor application.

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
- Current safe fallback: tapping Google in Android stays on the auth screen with a clear Arabic message, makes no OAuth/provider request and never opens a raw JSON error page. An existing valid session must still restore without creating another account.
- Before native login can be declared working: on a real phone, complete Google consent, prove a code bound to the initiating container's verifier/state returns to the same container and existing account, and test cancellation, duplicate callbacks, cold/warm starts and process death. These tests have NOT been performed.
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

## Phone report correction — 2026-11-23
- Reviewed installed `@lovable.dev/cloud-auth-js` 1.1.2 and registry latest 1.3.0 (downloaded for inspection only; no dependency change). Public API: `signInWithOAuth`, `redirect_uri`, `extraParams`, `oauthBrokerUrl`, `supportedOAuthOrigins`. Neither exposes a public Capacitor system-browser PKCE handoff. The `LovableApp/` iframe branch is specific to Lovable's own app; changing user agents or forwarding bearer tokens is not an acceptable substitute.
- Official references: https://docs.lovable.dev/features/google-auth and https://docs.lovable.dev/features/authentication. Backend custom-scheme redirect support is not proof of managed-broker native support.
- Badge: official Hide Lovable Badge was **false**; the mutation tool refused hiding because it requires editor access on Pro or higher. That official setting is project-wide, not Android-only. No setting was changed.
- Live Chromium at 390×844 on the published `/auth` displayed the injected `lovable-badge`; `/auth?forceHideBadge=true` contained no badge. This flag is observed working, **not documented as a stable contract**. Android launch URLs now include it; native Android hard reloads reapply it to the same HTTPS page without forwarding OAuth material. Web visitors and CSS/DOM are unchanged. Recheck after hosting changes; official alternative: an eligible editor enables Project Settings → Publishing → Hide Lovable Badge (affects the published website as well).
- Publishing the changed hosted application is needed for the error/return safeguards. A fresh APK/AAB is needed for the changed launch URL; the APK already installed on a phone does not acquire a new native configuration from a Git commit.

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

## Windows Android Studio build compatibility
- Use `bun install` then `bun run android:debug` to generate a debug APK, or `bun run android:apk` / `bun run android:aab` with release signing configured.
- The production Android launcher runs `bun`, `npx cap sync android`, and `gradlew.bat` on Windows or `./gradlew` on Linux/macOS. It does not change Google OAuth or test login.
