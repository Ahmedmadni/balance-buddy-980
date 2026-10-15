# Rasd Android signed AAB: internal testing only

The standard `android-debug.yml` CI produces a signed-by-debug-keystore APK, **not** a Play-release package. `.github/workflows/android-signed-aab.yml` is a **manual-only** workflow that can create an explicitly versioned, signed AAB **only after** configuring protected GitHub secrets.

## Configure protected environment
Create a GitHub Actions environment named `android-internal-testing`. Prefer required reviewers and restrict its allowed branches to the approved release branch. Set secrets:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded JKS keyfile, encoded on your machine.
- `ANDROID_KEYSTORE_PASSWORD`: key store password.
- `ANDROID_KEY_ALIAS`: the alias in your release key store.
- `ANDROID_KEY_PASSWORD`: signing key password.

**Never paste credentials in issues, pull requests, workflow input boxes or repository files.** Protect an offline copy of the signing key and its recovery details separately from GitHub.

After this workflow merges into `main`, run it from **Actions → Rasd signed Android AAB (manual only) → Run workflow**. Supply an integer `version_code` larger than the previous Play Console upload and `version_name` such as `1.0.1`. The workflow builds Capacitor 8 using `CAP_ENV=production`, configures release signing from environment variables without recording passwords in Git/Gradle files, verifies AAB jar signing and uploads the bundle for **internal** testing. There is **no automatic publication**.

## Prerequisites still blocking store release
1. Confirm the **published** production URL in `capacitor.config.ts` is your authorized, owned domain.
2. Implement and test Google OAuth via system browser and secure callback with Play/App Links on a real Android device. Google's OAuth endpoint must not be shown in embedded WebView.
3. Deploy/test encrypted backup Storage to the **correct** Supabase project (currently unavailable from the connected account).
4. Verify Play Console Data safety, privacy policy, content rating, the phone experience, Android screenshots and privacy disclosures.
5. Test complete restore, permissions, data deletion, emergency no-network UI and file picker on a real Android phone.

No signing key exists in this repository; an AAB has **not** been built by the manual release workflow.
