#!/usr/bin/env bash
# Fresh-install Android smoke test. No Google login or financial user data.
set -euo pipefail
APP="app.lovable.rasd"
APK="${1:-android-apk/app-debug.apk}"
EVIDENCE="android-smoke-evidence"
mkdir -p "$EVIDENCE"

adb install -r "$APK"
adb shell pm path "$APP" | tee "$EVIDENCE/package-path.txt"
adb shell am start -W -n "$APP/.MainActivity" | tee "$EVIDENCE/launch.txt"
sleep 20
adb shell pidof "$APP" > "$EVIDENCE/pid.txt"

# Capture accessibility hierarchy as evidence that the remote WebView is
# actually rendering. A running process by itself is an insufficient test.
adb shell uiautomator dump /sdcard/rasd-window.xml || true
adb pull /sdcard/rasd-window.xml "$EVIDENCE/portrait-ui.xml" || true
adb exec-out screencap -p > "$EVIDENCE/portrait.png"
if ! grep -Eq 'مرحب|تسجيل الدخول|متابعة باستخدام جوجل|Google|رصد' "$EVIDENCE/portrait-ui.xml" 2>/dev/null; then
  echo "ERROR: Android process launched, but login UI was not detectable." >&2
  adb shell dumpsys activity activities > "$EVIDENCE/activity.txt"
  exit 1
fi

# Return from the launcher / app background and verify Android resumes.
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am start -W -n "$APP/.MainActivity" | tee "$EVIDENCE/resume.txt"
sleep 3
adb shell pidof "$APP" >> "$EVIDENCE/pid.txt"

# Native system UI sizing test complements Playwright's responsive test.
adb shell wm size 360x800
adb shell wm density 320
sleep 3
adb exec-out screencap -p > "$EVIDENCE/compact.png"
adb shell wm size reset
adb shell wm density reset
adb shell dumpsys activity activities > "$EVIDENCE/activity.txt"
adb logcat -d -b crash > "$EVIDENCE/crash-log.txt" || true
if grep -q 'FATAL EXCEPTION' "$EVIDENCE/crash-log.txt"; then
  echo "ERROR: Android fatal exception detected, see crash-log.txt" >&2
  exit 1
fi
echo "PASS: installed, rendered login UI, resumed after background, resized, and no native fatal crash."
