#!/usr/bin/env bash
# Boot smoke: install APK, ensure Rasd is in foreground without system ANR.
# Never signs in; Google OAuth needs physical-phone QA.
set -euo pipefail
APK="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
[[ -s "$APK" ]] || { echo "APK missing" >&2; exit 1; }
mkdir -p android-smoke-output

capture_diagnostics() {
  adb shell screencap -p /sdcard/rasd-smoke.png >/dev/null 2>&1 || true
  adb pull /sdcard/rasd-smoke.png android-smoke-output/rasd-smoke.png >/dev/null 2>&1 || true
  adb logcat -d -t 1200 > android-smoke-output/last-logcat.txt 2>/dev/null || true
  adb shell dumpsys window > android-smoke-output/window-focus.txt 2>/dev/null || true
}
trap capture_diagnostics EXIT

adb wait-for-device
adb install -r "$APK"
adb shell am start -n app.lovable.rasd.localdev/.MainActivity
sleep 15
focus=""
for attempt in 1 2 3 4 5 6; do
  focus="$(adb shell dumpsys window | grep 'mCurrentFocus=' | tail -n 1 | tr -d '\r')"
  if [[ "$focus" == *"app.lovable.rasd.localdev"* ]]; then break; fi
  echo "Waiting for Rasd foreground window (attempt $attempt): $focus"
  sleep 5
done
if [[ "$focus" != *"app.lovable.rasd.localdev"* ]]; then
  echo "Rasd never became the focused app; system dialog/launcher may be blocking it" >&2
  exit 1
fi
pid="$(adb shell pidof app.lovable.rasd.localdev | tr -d '\r' | awk '{print $1}')"
[[ -n "$pid" ]] || { echo "Rasd exited after startup" >&2; exit 1; }
sleep 3
focus="$(adb shell dumpsys window | grep 'mCurrentFocus=' | tail -n 1 | tr -d '\r')"
[[ "$focus" == *"app.lovable.rasd.localdev"* ]] || { echo "Rasd lost focus to system UI: $focus" >&2; exit 1; }
# Verify the native privacy flag on the ACTUAL emulator window, not
# merely the patch script. This is critical for a financial app.
secure_window="$(adb shell dumpsys window | sed -n '/Window #[0-9].*app\.lovable\.rasd\.localdev.*MainActivity/,/Requested w=/p')"
if ! printf '%s\n' "$secure_window" | grep -Eq 'fl=.*[[:space:]]SECURE([[:space:]]|$)'; then
  echo "Android MainActivity missing FLAG_SECURE; screenshots or recents could reveal financial data" >&2
  exit 1
fi
echo "Native FLAG_SECURE verified on emulator window."
echo "Rasd is installed, running (PID $pid), and visible in foreground."
echo "Network/API, Google OAuth, finance features and actual phone UX remain unverified."
