# رصد — Android runtime verification (2026-11-16)

This is an evidence-based release matrix. **"Compiles" ≠ "works on an Android handset."**

| Area | Automated proof | Still requires a real-device test |
| --- | --- | --- |
| Android APK | Gradle assembleDebug via GitHub Actions | Release signing, update without losing local data |
| Fresh launch | Emulator install, Activity launch, startup PID, login accessibility tree and screenshot | Network conditions on each device vendor |
| Background/return | Emulator HOME + return, process survives, crash log check | Android battery saving modes and actual Recents thumbnail |
| Layout | 320/360/393/430px Playwright RTL overflow tests; Android 360×800 screenshot | Font scale 150–200%, tablets, keyboard, split-screen |
| Google authentication | Source-level callback configuration only | **Intentionally deferred**; Google sign-in and browser return need a real device and backend redirect configuration |
| Backups v2 | PBKDF2/AES-GCM round-trip, bad password, tamper tests | Export via Files/Drive chooser, close app and re-import saved file |
| Financial restore | Database migration/integration tests; explicit destructive confirmation | Restore end-to-end using a **nonproduction account** and compare record counts |
| Reports XLSX | Browser code and TypeScript checks | Actual Android Files/Drive share and Excel opening |
| Reports PDF | Android native PrintManager compiled in APK; screen print CSS | Open print sheet and use **Save as PDF** on device, verify RTL and pagination |
| Local reminders | Unit tests for due time and reconciliation with pending OS notifications | Android 13+ permission, background delivery, reboot and battery optimisation |
| App PIN/biometrics | PIN throttle unit tests, platform bridge compiled | Real fingerprint/face hardware and lock after resuming |
| Internet outage | Banner and no offline-write guarantee | Reconnect and verify whether a transaction was committed |
| Offline operation | **Not implemented**: Android shell uses hosted TanStack Start via HTTPS | Architectural change to local-first/offline sync if required |

## Manual Android acceptance protocol (use disposable data)
1. Install the latest debug APK without uninstalling an app holding local data. Check version signature compatibility first.
2. Verify the login screen on phone and tablet, RTL text, status/navigation bars, dark/light theme, large font and keyboard.
3. On a disposable test account, create and edit one item in wallets, debt, expenses, assets, recurring expenses, zakat and projects. Check calculated balances and refresh after restart.
4. Create a password-encrypted backup, **save to Files outside the application**, verify the file is present, then import into an isolated test account and confirm expected data without duplicate entries. Do not restore production data.
5. Generate one PDF and one XLSX financial report; reopen both from Files and verify amounts, Arabic text, right-to-left layout and page breaks.
6. Enable local reminders, verify permission request, schedule a due date, exit the app and observe its Android notification; repeat after reboot. Some OEMs delay notifications under power savings.
7. Test PIN incorrect attempts, biometrics, background snapshot and return after a minute.
8. With internet disabled, verify that the app warns and does not imply offline financial writes. Re-enable internet and confirm the stored records in the server.
9. **Google login remains the final acceptance stage** by request.

## CI artifacts
- `rasd-android-debug-apk` is a debug build only, not a signed release.
- `rasd-android-smoke-evidence` contains screenshots, UI XML, process and crash log excerpts from an emulator.
- Do not publish screenshots with real financial data to public CI artifacts: the emulator test does not sign in.

## Release criteria
Do not declare `100% works` until all required real-device rows are tested and OAuth has passed. The online-only architecture is an explicit limitation, not a verified offline feature.

## Android CI diagnosis and fixes (2026-11-16)
- Early expanded emulator tests failed while the Android **system process** was unresponsive (system dialog visible in screenshots) or ADB disconnected. This is not a confirmed application crash.
- After switching to an API 33 Pixel 2 emulator with KVM, an expanded smoke test **passed**: login UI was present in the accessibility tree, launcher return worked, and a compact screenshot was collected. Evidence: GitHub Actions run `43810844264`, job `133112606746`. No Google auth was initiated.
- Examining the passing emulator screenshot identified very low contrast on the login screen (black text against the navy underlying background). Added native-only hex colors and an `@supports not (color: oklch(...))` fallback for old WebViews; verify again on the installed APK after the hosted site is deployed.
- The same screenshot shows an **Edit with Lovable** badge supplied by hosting. Its removal, if authorized by the user's Lovable subscription, must be configured via the hosting platform; native code builds alone do not remove it.
- Supabase regression had a transient Mailpit port 54324 bind conflict. CI now excludes Mailpit and other unneeded services; subsequent database tests passed.
- Android packaging has three paths: the standard `rasd-quality` debug build, manual hosted debug and manual signed release. All now apply `scripts/ensure-android.mjs` before native sync so OAuth deep links, privacy flags, and native PrintManager are consistently included.
- The APK packages a local **offline.html** recovery page for WebView load errors with an explicit retry action. This is a connectivity UX fallback, *not offline accounting*. Some DNS/TLS hangs may not invoke the page; a real-device cold-start offline test remains required.

## Android phase 5: on-device native diagnostics and overdue delivery deduplication
- In Settings → Device, the Android-only **فحص وظائف الهاتف** action tests a real temporary cache write/read/delete, queries notification permission and pending OS alarms without requesting permission, and checks registration of Share, RasdPrinter, and App plugins. No user financial records are read or modified.
- **تجربة حفظ ملف** opens the actual Android share chooser for a harmless text file. The user must choose Files or Drive and confirm that the file exists outside the application; a successful chooser launch is not proof of persistent storage.
- Corrected misleading Android export-folder copy: files **do not** automatically appear in Downloads. The share chooser must be completed by the user; app cache is temporary.
- Once-daily overdue reminder now persists a user-scoped local calendar-day marker separately from scheduled-alarm IDs, so delivered alarms disappearing from `getPending` do not cause repeats every 10 minutes. Clearing local app data or explicitly switching the alerts off and on resets this marker.
- The diagnostic deliberately does **not** trigger a PDF print or send a notification, as those would intrude into the owner's workflow. Google sign-in remains deferred; automated tests cannot prove actual background delivery, biometrics or real-device report print completion.

## Backup v2 preflight parity (phase 5)
- Before **any restore confirmation**, the web and Android client now requires all 19 named collections that the server-side `restore_user_backup` RPC requires, verifies they are arrays of objects, rejects forbidden derived/system/attachment collections, and rejects identity fields (`user_id` on rows and `id`/`user_id` on profile).
- The server remains the authoritative validator before any destructive work. UI validation is additional protection, not a replacement.
- The destructive confirmation previews total row count and major collection counts; a fully empty (but structurally complete) backup receives an explicit warning that the covered financial records will be replaced/cleared.
- An encrypted file still requires its passphrase and the typed confirmation `استعادة`. Never experiment with restoration on a production account.

## Phase 6: cross-account privacy and reminder-operation ordering (2026-11-17)
- Android native reminder scheduling and cancellation now share a serialized queue. If the user presses sign-out while a slow database fetch or notification scheduling is in flight, previously started schedules finish **before** logout cancellation; any queued stale sync requested earlier is invalidated.
- The app shell suppresses further reminder ticks while sign-out is underway. A failure to cancel Android alarms does **not** prevent signing out; it shows a warning that an old alarm may persist. Sign-out must never depend on a notification plugin working.
- The top-level auth listener cleans the financial TanStack Query cache and requests reminder cancellation for implicit/automatic SIGNED_OUT events as well as user-triggered logout.
- In-place authentication transitions between different user IDs also clear old financial query results and native reminders, because not every query key is currently scoped by user ID. Same-account authentication/refresh avoids unnecessary eviction.
- Unit regression tests cover queue ordering, plugin failure recovery and account isolation. The real-device acceptance test must switch between **two disposable test accounts**, confirm account A amounts do not flash on account B's pages, and confirm old notifications are absent from Android system settings after sign-out; avoid exposing real financial data during testing.
- **Limits:** app PIN remains a UI-only device-level lock. This is not Android Keystore-backed database encryption; full offline-first use is not implemented. Testing the Google OAuth browser/deep-link flow remains deferred.

- Logout and account switching now also query Android OS pending alarms and cancel those tagged `extra.rasd === true` in the app-owned ID range, even when WebView localStorage no longer has their IDs. They do not cancel unrelated alerts. A fresh account sync performs orphan-alarm cleanup if its local plan is empty.
- A real-device test must verify that these tagged alarms are removed after simulated WebView-storage loss, and verify that unrelated app alarms remain; no test in CI can prove OEM alarm persistence or OS settings behavior.
- Sign-out waits at most **5 seconds** for the OS notification cleanup attempt, so a hung network refresh cannot trap the user in a signed-in session indefinitely. If the timeout or native plugin fails, sign-out continues with a warning and cleanup remains queued; verify on a real Android device with its internet disabled.
