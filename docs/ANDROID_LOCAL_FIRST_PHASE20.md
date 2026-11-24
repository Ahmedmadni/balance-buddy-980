# Rasd Android LOCAL — phase 20 (2026-11-24)

## Change of product direction

The owner has decided that Rasd will ultimately be a **standalone Android financial application**: personal data, authentication and daily usage are local, with optional owner-directed encrypted backup sharing to device storage or Google Drive. Google OAuth and Supabase are no longer part of the target application's normal login or persistence.

**This is phase 1 of a substantial migration, not a completed replacement of the existing web/SSR system.** To protect existing finance data, this commit creates an isolated beta with package ID `app.lovable.rasd.local`, installed beside the existing `app.lovable.rasd`. It **does not** wipe, migrate, read or overwrite cloud records. Do not remove the legacy app or production Supabase until verified migration tooling exists.

### Android beta build

- `bun run android:offline:debug`: creates `dist-native/index.html`, prepares Android, generates logo assets, packages a debug APK.
- `bun run android:offline:apk` and `bun run android:offline:aab` require appropriate release signing before distribution.
- `bun run build:offline`: static Vite bundle with local React entry, not TanStack Start SSR. This bundle is packaged inside the APK with **no Capacitor `server.url`**.
- The current web and cloud Android builds remain accessible as separate, unchanged build commands for a safe migration period. Do **not** use `bun run android:debug` and mistakenly call it offline; that command is still cloud-hosted.
- Use `CAP_LOCAL_ONLY=1` for any direct `cap sync` of this beta; it must not be mixed with a previously generated cloud Android project. Use a clean generated `android/` folder when switching package identities.
- The offline beta has a strict static HTML Content Security Policy including `connect-src 'none'`. No cloud authentication or network persistence is bundled.

### Implemented v1 functionality

- Owner chooses a password of at least 12 characters.
- Each vault has a **random 256-bit data-encryption key**. The key is wrapped by a PBKDF2-SHA256 (600,000 iterations) password-derived AES-GCM key. An independent high-entropy recovery code wraps the same vault key; the recovery code is shown once during setup.
- The JSON ledger is encrypted using AES-256-GCM and saved under Android's app-private `Directory.Data`. Transactions use integer minor units (halalas) and the data schema validates wallet references and amounts before every write. An additional previous encrypted file and an intermediate write verification reduce, but do not eliminate, crash-related loss risks.
- Initial UI for wallets (opening balance), income/expenses, debts, balance calculations and encrypted JSON export/import. The user chooses device Files or **Google Drive from Android's share sheet**; the app never uploads automatically or accesses Drive through an OAuth account.
- User can reset the password using the high-entropy recovery code and choose a new password. Recovery questions such as mother's father's name or birth date **are NOT accepted as a standalone vault unlock**: they can be guessed or learned and do not reconstruct the encryption key. See NIST SP 800-63B and OWASP.
- Unlock keys exist only in process memory during an open session and are erased when explicitly locked. The beta automatically locks after one minute spent in the background; this is an additional convenience guard, not a substitute for full Android Keystore integration.

### Incomplete items: DO NOT claim finished

1. **Existing cloud migration:** the old project has detailed debts, events, investments, recurring records, projects and other schemas. The beta currently supports only simplified wallets, movements and debts. Do not import a legacy Supabase backup by treating it as `.rasd`; design a separate verified one-time migration with source/target counts, referential integrity and rollback.
2. **PIN, pattern, fingerprint/face:** those must be implemented with appropriate Android Keystore-backed key wrapping, biometric authentication and device-credential policy, including enrollment changes, failure lockout and safe fallback. A short PIN/pattern alone is not a high-entropy encryption secret. Existing biometric auth plugin alone authenticates; it does NOT securely persist the encryption key across app restarts. None of these methods is enabled by phase 20.
3. **Storage hardening:** add Android Keystore wrapping, screen capture controls for sensitive views, file integrity/atomic replacement under abrupt process death, and testing on multiple actual devices. Current two-copy file technique is not an SQLite transaction.
4. **Backups:** test Android document picker import, persistent backup locations and Drive save/restore through share sheet on a physical device; the share action opening is not proof a user saved anything.
5. **Financial breadth and migration:** add all original modules, edits/deletes and account relationships, recurring operations, analytics, reports/exports, notifications and database upgrades. Consider SQLCipher/Room when financial data volume expands.
6. **Recovery:** the random recovery code cannot be reissued currently without resetting the vault; losing it along with the password means encrypted data are unrecoverable. Do not promise questions can bypass encryption.
7. **Security test/acceptance:** current CI validates cryptography and offline start, but it does not replace penetration testing, accessibility, physical device verification, destructive storage crash testing, or formal financial reconciliations.

### Backup and recovery user steps

1. During first setup, write down the `RSD-` recovery code on a separate medium. Do **not** save it beside the encrypted backup file in the same Google Drive folder.
2. In **النسخ**, select **تصدير نسخة مشفرة** and choose Files/Drive in the Android share sheet; visually confirm successful save in the destination application.
3. To restore, select the `.rasd` file with the Android picker, provide that backup's password and explicitly type **استبدال** if an existing vault will be replaced. Export an up-to-date backup first.
4. If the password is forgotten, use the recovery code to set a new password *without contacting any server*.
5. The old cloud project's backups are a different format, and **are not compatible with this importer**.

## Source integrity checks

- `bun run typecheck`
- `bun test src/lib/offline`
- `bun run build:offline`
- GitHub Actions `Rasd standalone offline Android beta`: local-only APK build, assert no `server.url` and beta package ID; install and run with Wi-Fi/data disabled on the emulator.

**Release policy:** Only call the variant `app.lovable.rasd.local` an offline **beta** until all modules, import/migration, security and device acceptance are complete. The original `app.lovable.rasd` remains unchanged.
