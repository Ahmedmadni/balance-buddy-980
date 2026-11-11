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
