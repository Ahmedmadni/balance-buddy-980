# Remaining development

- [x] Harden Google sign-in return flow; session boundary regression tests passed.
- [x] Verify authenticated navigation and backup confirmation without restoring real data.
- [x] Inspect GitHub failures and run Android packaging; fix obsolete SDK tools selection and missing configuration prerequisites.
- [x] Patch production dependency vulnerabilities; all 97 regression tests pass and production dependency audit is clean.
- [x] Verify debug Android build succeeded on GitHub (run 41420922221).
- [x] Provide the debug APK artifact download path; not a signed production release.
- [x] Document Google Drive, signing, ads and device-testing prerequisites in the release guide.
- [x] Record verified completion and outstanding release blockers.
- [x] Harden manual signed APK/AAB workflow input validation and verify both package signatures.
- [ ] Run signed APK/AAB workflow: repository signing secrets are absent as checked on 2026-11-03; device testing also pending.
- [ ] Google Drive backup: requires per-user authorization and an approved cloud backup implementation.
- [ ] Production AdMob: requires real ad-unit IDs and native SDK/consent integration.