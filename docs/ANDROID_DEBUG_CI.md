# Android APK CI — preliminary build, NOT launch certification

This workflow creates an ephemeral Android project with `bunx cap add android`, synchronizes a minimal local entrypoint, and attempts to compile an installable **debug** APK. It uploads an APK artifact only when Gradle succeeds.

The production configuration loads the existing HTTPS site (`capacitor.config.ts`, `server.url`). Consequently, **the Android APK is not a self-contained offline application**, and its Google OAuth session return flow **has not been proven on a device**. Do not publish this debug binary to Google Play. The Android folder is deliberately not committed, so its generated Gradle settings cannot yet be audited. The Android pipeline is a smoke-build, not a signed release workflow.

The fallback `dist/client/index.html` is necessary for the Capacitor CLI because the TanStack Start SSR build has no static HTML entrypoint. It must not be represented as a completed offline app.

## Before Android production approval
1. Choose a native-compatible auth integration (external system browser/Chrome Custom Tabs with verified App Links and session callback). Never send the Google sign-in form through an embedded WebView.
2. Test first login, interrupted login, returning users, token renewal, logout and expired sessions on a real Android device.
3. Decide whether to retain the hosted-SSR app (online required) or refactor to a local client app with an offline data strategy.
4. Commit and review native Android platform files after generation; configure permissions, versionCode, backup rules, notifications and deep links.
5. Configure external Android signing keystore and release pipeline, and verify with Play Console internal testing.
6. Validate backup restore and cloud providers before calling the app finished.

Fonts IBM Plex Sans Arabic and Cairo are vendored under `public/fonts` under their respective OFL licenses. Static fonts can be served from the application's own origin without contacting Google Fonts. This alone does not make the entire SSR application usable offline.
