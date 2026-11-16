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
