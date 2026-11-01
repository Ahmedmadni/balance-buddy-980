# Remaining development

- [x] Harden Google sign-in return flow; session boundary regression tests passed.
- [x] Verify authenticated navigation and backup confirmation without restoring real data.
- [x] Inspect GitHub failures and run Android packaging; fix obsolete SDK tools selection and missing configuration prerequisites.
- [x] Patch production dependency vulnerabilities; all 97 regression tests pass and production dependency audit is clean.
- [ ] Rerun corrected Android workflow after updated source reaches GitHub; prior run failed during SDK setup, so no download exists.
- [ ] Provide a verified APK download path after a successful build; blocked by the packaging rerun above.
- [x] Document Google Drive, signing, ads and device-testing prerequisites in the release guide.
- [x] Record verified completion and outstanding release blockers.
- [ ] Signed store APK/AAB: requires owner's release keystore and device testing.
- [ ] Google Drive backup: requires per-user authorization and an approved cloud backup implementation.
- [ ] Production AdMob: requires real ad-unit IDs and native SDK/consent integration.