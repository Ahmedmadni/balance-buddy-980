# Rasd local Android — phase 21: Android Keystore quick unlock

Date: 2026-11-24. Scope: **isolated** `app.lovable.rasd.local` debug/beta app only.

## What this phase implements

The owner's offline-first decision remains in force: no Google OAuth, Supabase, hosted website, account sync, or cloud credentials are used by the **offline** APK.

After unlocking with the **master password or independent recovery code**, the owner may optionally enable **فتح بقفل Android** from the Backup/Settings tab. An Android 11 (API 30)+ device with a secure screen lock is required.

- AndroidKeyStore creates an AES-256-GCM key with `setUserAuthenticationRequired(true)`, `setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG | AUTH_DEVICE_CREDENTIAL)`.
- The app's independent random financial-vault data key is wrapped with that hardware/system-backed key, through `BiometricPrompt.CryptoObject`. Only the IV and wrapped ciphertext are retained in Android's app-private `SharedPreferences`. No PIN/password/pattern or biometric data are copied or stored by Rasd.
- To unlock, the OS prompts for an appropriate **strong biometric** (fingerprint or qualifying Class 3 face) or the phone's own **device PIN/pattern/password**. Android authenticates the Keystore cipher operation; only then can the plugin return the unwrapped vault key to the local React application.
- The cryptographic key is bound to the particular vault via a stable, content-independent digest of the recovery wrapping. Changing the main password or writing transactions does not break device unlock; restoring a different vault does not silently reuse the wrong key.
- The native code is generated from `native/android/RasdDeviceUnlockPlugin.java` into the **local-only** Capacitor Java package and explicitly registered in `MainActivity`; it is not included in the cloud APK. Offline Vite bundles the typed JS bridge.
- When Android enrollment, screen-lock credentials or the hardware key become unavailable, the feature fails closed with an error and the owner can still unlock using their **master password or separate recovery code**.
- A device-unlock shortcut is **not** transferred in the `.rasd` encrypted backup and must be enabled afresh after restoring on another device.
- The normal password-only setup remains the default. The owner must deliberately opt in after unlocking the vault.

## What this does NOT provide

- This is **not a separate custom 4–6-digit in-app PIN or custom gesture pattern**; those would require separate device-backed, hardware-rate-limited key protections and cannot safely replace the master key with a naive numeric PBKDF.
- Face unlocking requires Android's **BIOMETRIC_STRONG** security class. Many phones' simple camera-based face recognition is too weak to authorize cryptographic operations. Device PIN/pattern can serve as the OS fallback when configured.
- Actual biometric enrollment, KeyStore invalidation on device-lock changes, phone manufacturer variations, prompt cancellation, backup sharing, and recovery under low storage all require **physical-device testing**. CI verifies Java compilation, plugin registration, unit-level cryptographic binding, and native offline startup only; it does not claim to spoof an actual human biometric.
- There remains no verified migration of old Supabase/cloud financial records. Preserve the earlier cloud application and data until complete reconciliation.
- Database and backup durability remains phase 20's app-private Filesystem approach; native atomic-file transactional hardening is future work, as is feature parity for all older reports, recurring expenses, and investments.

## Acceptance matrix

1. New device with a secure lock: create local vault, save external recovery code, add a wallet, lock, unlock by password.
2. Enable device unlock; provide valid OS authentication. Lock and open again through fingerprint or screen-lock prompt, check exactly the same wallet balance.
3. Cancel the OS prompt: must **not** unlock. Wrong authenticator, absent enrollment or reset: master password fallback.
4. Rotate main password: device unlock should continue for the *same* encrypted vault.
5. Import a different `.rasd` vault: old hardware shortcut must not unlock it.
6. Clear app data, revoke device lock, delete biometrics, or restore to a new phone: previously wrapped key may disappear; require password/recovery, and do not promise remote recovery.
7. Test backgrounding for at least 60 seconds: on resume, access must require authentication.
8. Test biometric integration on a real Android 11+ phone in addition to CI. Do not release as production before this gate.

Build: `bun run android:offline:debug`. Workflow: `.github/workflows/rasd-offline-android.yml`.
