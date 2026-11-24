# Architecture rules

- Fail closed for native managed Google login until a documented Capacitor session handoff is available; the broker's private LovableApp iframe bridge cannot be substituted for PKCE.
- Scope the observed hosting badge query flag to native Android launch/reload URLs, not CSS or web visitors; the official project setting remains the supported alternative.

- Complete managed social login on the public auth page and navigate into the guarded app only after a session is available; OAuth returns can precede session hydration.
- Keep Backup v2 file validation in a browser-safe pure module and perform data operations only through the existing export/restore RPCs; invalid files must never reach restore.
- Treat Android as a hosted HTTPS client of the SSR application until a local-shell architecture is explicitly implemented; do not remove its production server URL or claim full offline startup.
- Package hosted Android CI with a bootstrap document and a verified HTTPS origin, without rebuilding SSR or requiring database credentials; the installed client loads the published application.
- Keep signed Android releases manual-only, pass validated version inputs through environment variables, and verify APK/AAB signatures before uploading; this prevents input injection and accidental distribution of unsigned packages.
- Disambiguate embedded financial reads with the existing owner-scoped foreign key names; parallel legacy foreign keys otherwise cause ambiguous relationship failures.
- A UUID-backed restore hold must never be manually released on `not_found`; release only on verified server `committed` or `cancelled` status. All delayed-request cancellation uses the same per-account SQL advisory lock and never touches real financial records in CI.

- Native Android Google sign-in MUST use browser PKCE code redemption inside the initiating WebView; never accept access/refresh tokens in deep-link URLs, never call Google in embedded WebView, and never mistake a separate browser session for an app session. Do not enable the hosted public `VITE_RASD_NATIVE_GOOGLE_OAUTH_READY` flag before Supabase Google credentials and exact callback allowlist are configured and device acceptance is complete.

- Native Google OAuth must persist a token-free quarantine before any PKCE session exchange; a failed local sign-out or residual cached token must leave protected financial routes blocked across WebView restarts. Provide a local-only recovery path; never clear quarantine solely on a successful signOut RPC status without rechecking getSession.
