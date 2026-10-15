# Android 35 emulator smoke test

The `.github/workflows/android-emulator-smoke.yml` builds a **debug**
Android APK and uses a GitHub-hosted Android API 35 emulator to confirm that
the APK installs and `app.lovable.rasd/.MainActivity` launches and remains
alive. The workflow saves an anonymous screenshot and recent logcat excerpt.

This validates **APK boot** only. It does **not** validate Google OAuth
(embedded WebViews are not a supported Google sign-in surface), Android
App Links callbacks, a user session, finance operations, offline mode,
screenshot readability on every device, or encrypted backups.

Before production release, a human tester must perform first login, return
from external browser, logout/login again, restore password failures and
recoveries, large-text/RTL checks, Android back button, network disruptions
and file upload/download on a **physical** phone, using disposable data.

The production URL is a remote hosted SSR page. On the emulator it may show
a network-unavailable fallback depending on DNS/network; merely launching
does not prove the page is usable.
