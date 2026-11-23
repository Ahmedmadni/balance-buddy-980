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

## Phase 7 — accounting correctness in report exports (2026-11-18)
- Report queries for transaction history, persons' ledger and investment transactions previously used `lte('happened_at', 'YYYY-MM-DD')`. For timestamp values this can exclude transactions later in the selected final day. Queries now use the **half-open** range `gte(from)` and `lt(next calendar day after to)` to include that whole day. The pure date-range helper rejects impossible or inverted dates and covers month/year/leap transitions.
- The asset report previously passed **only the selected period's investment transactions** to `computeAssetMetrics`, causing book value and total P&L to omit CapEx and income from earlier periods. It now uses **all investment history** for the current cumulative snapshot, while selected-period CapEx, OpEx and income appear separately in the UI and Excel.
- These are current-valued assets (including current sale status and current market value), **not historical as-of snapshots**. The report explicitly labels current cumulative profit versus selected-period flows. Do not infer historical closing balances from the current snapshot.
- An invalid report period disables exporting/printing rather than producing misleading zero totals. Financial regression tests cover a final-day transaction at 23:59:59, leap-day/month/year boundaries, and prior-period CapEx.
- Android Excel exports continue to use the native file chooser; PDF/print uses Android PrintManager and remains subject to real-device Save-as-PDF verification. No Google OAuth tests were performed.

## Phase 8 — user-triggered Excel/PDF export acceptance helpers (2026-11-19)
- Android Settings → Device includes synthetic sample **Excel** and **PDF** export buttons alongside the previous text-file share test.
- The Excel sample creates a genuine XLSX workbook with Arabic headers, stable numeric values (123.45 and 23.4), and currency text; unit tests reopen the binary and verify its sheet and cell types. The PDF sample creates an A4 PDF using jsPDF with a known English heading and values, and a unit test checks the PDF magic header and content. English test text avoids suggesting built-in jsPDF fonts can render Arabic without custom embedding.
- Both use the exact same Filesystem cache → Android Share chooser path as financial report exports. The user must choose Files/Drive, save externally and reopen the file; merely opening the chooser is not proof of permanent storage.
- Samples contain **no real finance data**, account IDs, auth tokens or Supabase calls. They do not verify PDF printing with Android PrintManager, which is a separate manual acceptance test performed using the actual report print action.

## Phase 9 — print-isolation and PDF readability (2026-11-19)

- Fixed the previously global print-only `body * { visibility: hidden !important; }` rule, which blanked out non-report browser printouts. Report isolation now applies only when the report route has mounted `html.rasd-report-page`; the route removes this class on unmount.
- For the `#rasd-report-print` element, print CSS now provides an A4-friendly borderless container, repeatable table headers, nontruncated descriptions, readable grid text, row/page-break protection and print table borders.
- Android's background privacy blur remains on screen and in app-switcher thumbnails, but is explicitly disabled **inside print media on the report route**. This avoids a blurred document if Android PrintManager temporarily puts the WebView Activity in the background.
- The explicit report-print action refuses to print when the report route/body is missing, and refuses while privacy mode hides monetary amounts. In the latter case the user must disable the privacy toggle before printing; the app does not silently unblur data.
- Browser E2E tests emulate print media and verify that login pages remain printable; when the report class is active, surrounding UI is hidden, table content remains visible, text truncation is removed and background snapshot blur does not enter print output. Unit tests cover print preflight safety.
- This validates **CSS and bridge integration**, not real OEM Android Save-as-PDF completion. A user must still open Settings → Device, test a synthetic PDF export, and use the report's "طباعة / PDF" action to verify Android PrintManager saves a multipage Arabic report.
- Google OAuth testing remains intentionally deferred; no financial data were changed.

## Phase 10 — legacy backup v1 retirement (2026-11-19)

- Discontinued **new plaintext v1 financial backup exports and local-cache writes** on web and Android. All new whole-account backup and restore actions go through authenticated server-side v2 RPC and password-protected AES-256-GCM export.
- Disabled legacy `importUserData` table-by-table `merge`/`replace` writes at the engine level. The previous replace path could delete several tables and then fail on a later insert without a transaction; retrying or silently resuming is unsafe. Only preview-only calls remain non-mutating.
- Settings → Backup now includes the **read-only v1 archive inspector**: choose an old v1 JSON file (max 50 MB), display only scope, creation date, number of tables/rows and count inconsistencies. It never inserts or deletes records, reads no current user records, and does not save the imported plaintext to localStorage/IndexedDB.
- A separate user-confirmed action deletes the historical cached v1 backup from both IndexedDB and localStorage. Never auto-delete historical archives, as they may be someone's sole surviving copy. This action does not delete external Downloads/Drive copies or server-side data.
- Users who only possess a v1 file **cannot restore it through the retired non-atomic UI**. Do not promise automatic conversion to v2: the schemas differ. Retain the file safely until a validated migration path is explicitly developed and tested.
- Existing v2 encrypted backups are unaffected. The v2 restore is still destructive to current account data; inspect record counts and preserve an independent verified backup before running it. Tests cover legacy metadata-only inspection and hard-disabled v1 export, file writing and partial restoration.
- Device acceptance: verify no v1 export/restore buttons remain, verify inspecting an old archive does not change the account's data, and confirm clearing local cache only affects old unencrypted in-app copies. No real financial records or Google OAuth were used in CI.

## Phase 11 — v2 backup atomicity & Android reminder consistency (2026-11-19)

- Extended the **disposable-only** SQL regression `supabase/tests/backup_restore_v2.sql` with a deliberately invalid wallet name that passes JSON type parsing but violates the database's `NOT NULL` constraint during the INSERT phase, *after* dependent table DELETE statements. The assertion requires SQLSTATE `23502` and confirms the old wallet, contact, wallet transaction, derived transaction and profile are preserved. An incomplete backup (missing contacts) must be rejected before any deletion.
- Added a second synthetic authenticated account in the same rolled-back SQL transaction. Export of account A must not include B's wallet and vice versa. Restore of B's snapshot must not alter A's wallet or contacts. These checks do not touch the user's production project.
- Added an encrypted **full-v2 schema** roundtrip test containing Arabic strings, amounts and dates; validated the 19 required data collections and checked ciphertext tampering. No real account passwords or financial data used.
- After a successful committed restore, Android clears old device alarms **before** refreshing active views and scheduling new ones, using the existing serialized native reminder scheduler. This prevents the 10-minute periodic tick from being the only opportunity to remove orphaned reminders. Permission requests remain opt-in (no prompt during restore).
- Follow-up errors in the WebView, network, or OS notifications do **not** run the destructive restore again. Instead, the UI warns specifically what remains uncertain and instructs the user **not to repeat the restore**. Unit tests verify operation order, native cleanup failure, view-refresh failure and web-only behavior.
- Caveats: the SQL regression proves transaction rollback in a disposable database, not every Android OEM reminder-delivery behavior. A final real-device check must restore a synthetic account, inspect fresh reminders, confirm data parity and deliberately exercise native notification permissions. Google OAuth remains deferred.

## Phase 12 — v2 restore request acknowledgement & account continuity (2026-11-19)

- Prior to opening the destructive confirmation screen, validate and decrypt the selected v2 archive and obtain the **current authenticated user ID**. Immediately before the RPC, revalidate that the session belongs to that same ID. No restore request is sent when authentication fails or the account changed while the dialog was open. This is an additional client-side guard; server-side `auth.uid()` / RLS remain the authority. If the authenticated account signs out or switches while a file is being previewed, the UI immediately discards the decrypted preview and closes the confirmation dialog; routine refresh of the same account's token is not treated as an account change.
- Successful restore requires an **explicit** SQL response `{ ok: true, format: "rasd-backup", version: 2 }`; a 2xx response without this payload is not treated as success.
- A definite 4xx rejection (except timeout 408 or throttling 429) is reported as rejected. HTTP/network errors without definitive acknowledgement, thrown fetch failures, timeouts, gateway errors or missing success markers are reported **unconfirmed**, since the server may have completed the transaction but the reply could be lost. The app deliberately sends no automatic retry.
- On unconfirmed result, discard the decrypted pending payload, close the confirmation dialog and block additional restore attempts in the current settings view. Display prominent guidance to inspect balances and transactions after reconnecting and **not repeat** the restore without verification. This guard persists while that settings view is mounted; leaving/reloading and manually starting a new attempt is possible and should not be described as globally prevented.
- The optional audit log and Android post-restore hooks must not downgrade an explicitly committed SQL result into “failed.” Tests cover the SQL success marker, explicit server rejection, ambiguous HTTP/network outcomes, wrong account, unavailable session and exactly-once invocation.
- No production financial records or actual Google login were used. Real-device acceptance still requires offline/online restore UI trials with a **disposable** test account, verifying both the unconfirmed warning and account-switch safeguards.


## Phase 13 — durable restore safety journal on Android / web (2026-11-22)

- The client writes an account-scoped `pending` journal entry **before** sending any destructive v2 restore RPC. The entry contains only the operation state and user ID in its storage key; no backup contents, financial amounts or passwords are persisted.
- A missing server response changes that entry to `unconfirmed`. If the WebView/app crashes before the response, `pending` remains. Both states block new restores after Settings remount, WebView reload, and normal Android process restart in the same app/browser storage. A storage-read/write failure also blocks the operation (fail closed).
- Explicit SQL success or confirmed rejection clears the journal; auxiliary UI/notification failures never turn success into an unconfirmed SQL transaction.
- To remove an unresolved hold, the user must independently verify the account after connectivity recovers, type `راجعت البيانات`, and pass a fresh authentication check. This is **manual acknowledgment**, not cryptographic proof that the original SQL request completed.
- The journal is scoped per account. Browser storage may be deleted by device maintenance, and this **does not enforce idempotency across devices or concurrent tabs**. A server-side operation ID and status query are still required for global exactly-once safety.
- Synthetic unit tests cover restart survival, reservation-before-send, in-flight crash, account separation, failed storage, definite outcomes, and explicit acknowledgment. No financial production data or Google OAuth is used.

## Phase 15 — delayed restore cancellation fence (2026-11-23)

- The previous phase-14 `not_found` acknowledgment was unsafe because an older HTTP request could arrive after the user manually cleared the hold. A UUID-backed restore now **cannot** be cleared by `acknowledgeRestoreHold`, even through another caller of the shared helper.
- After `not_found`, require an explicit typed `إلغاء الاستعادة` action and a confirmed `cancel_restore_operation` RPC. The server locks the same account as restore, inserts a permanent `cancelled` tombstone, and refuses delayed calls with that UUID. If the restore wins the race, cancellation returns `committed` instead and refreshes the displayed account.
- The app must retain the local hold if the cancellation RPC is missing/unreachable, returns an invalid payload, or authentication changes during verification. Legacy holds without UUID still need manual user reconciliation.
- CI SQL tests must confirm cancellation, idempotent cancellation, stale restore rejection, committed-wins race, isolation, and unauthenticated failure. Emulator startup alone does not validate this interactive flow; a real-device test with disposable records is still required.

## 2026-11-23: Native Google PKCE follow-up
Native OAuth code and deep-link completion were added after the user's phone showed the browser-only fallback never returned a session to the Android WebView. This remains gated behind a backend Google provider setup, redirect allowlist, and explicit hosted build flag. Source-level tests do not prove a live Google login, and a real-device end-to-end check is mandatory. See [ANDROID_RELEASE_CHECKLIST.md](ANDROID_RELEASE_CHECKLIST.md).
