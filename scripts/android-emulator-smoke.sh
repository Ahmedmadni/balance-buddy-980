#!/usr/bin/env bash
# Disposable emulator, no account login and no real financial data.
# Fail if Android itself is unhealthy OR the app does not expose login UI.
set -euo pipefail
APP="app.lovable.rasd"
APK="${1:-android-apk/app-debug.apk}"
EVIDENCE="android-smoke-evidence"
mkdir -p "$EVIDENCE"

collect_diagnostics() {
  adb devices -l > "$EVIDENCE/adb-devices.txt" 2>&1 || true
  adb shell dumpsys activity activities > "$EVIDENCE/activity.txt" 2>&1 || true
  adb shell dumpsys window > "$EVIDENCE/windows.txt" 2>&1 || true
  adb logcat -d -b crash > "$EVIDENCE/crash-log.txt" 2>&1 || true
  adb logcat -d -b main -b system -t 1200 > "$EVIDENCE/system-log.txt" 2>&1 || true
  adb exec-out screencap -p > "$EVIDENCE/last-screen.png" 2>/dev/null || true
}
trap 'collect_diagnostics' EXIT

adb wait-for-device
ready=""
for attempt in $(seq 1 50); do
  if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then ready=1; break; fi
  sleep 3
done
if [ -z "$ready" ]; then
  echo "::error::Android emulator OS did not finish booting; this is an infrastructure failure."
  exit 1
fi
adb shell input keyevent KEYCODE_WAKEUP || true
adb shell wm dismiss-keyguard || true
adb shell input keyevent KEYCODE_MENU || true

# Non-streaming installation avoids occasional ADB broken pipes in CI.
for attempt in 1 2 3; do
  if adb install --no-streaming -r "$APK" > "$EVIDENCE/install.txt" 2>&1; then break; fi
  if [ "$attempt" = 3 ]; then
    cat "$EVIDENCE/install.txt"
    echo "::error::APK installation failed; inspect ADB and emulator logs."
    exit 1
  fi
  sleep 5
done
adb shell pm path "$APP" | tee "$EVIDENCE/package-path.txt"
adb shell am start -W -n "$APP/.MainActivity" | tee "$EVIDENCE/launch.txt"

# UiAutomator fails if SystemUI is in an ANR state; use a local/tmp output
# instead of /sdcard where some emulator images deny access.
login_detected=""
for attempt in 1 2 3; do
  sleep 12
  adb exec-out screencap -p > "$EVIDENCE/portrait-$attempt.png" 2>/dev/null || true
  timeout 30s adb shell uiautomator dump /data/local/tmp/rasd-window.xml     > "$EVIDENCE/uiautomator-$attempt.log" 2>&1 || true
  adb exec-out cat /data/local/tmp/rasd-window.xml     > "$EVIDENCE/portrait-ui.xml" 2>/dev/null || true
  if grep -Eq 'مرحب|تسجيل الدخول|متابعة باستخدام جوجل|Google|رصد' "$EVIDENCE/portrait-ui.xml"; then
    login_detected=1
    break
  fi
done
if [ -z "$login_detected" ]; then
  echo "::error::Android login screen not observable. Emulator/SystemUI may be hung or network-hosted WebView may not have loaded; inspect screenshots and logs. Do not claim app validation."
  exit 1
fi

# Exercise native application lifecycle; no Google auth involved.
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am start -W -n "$APP/.MainActivity" | tee "$EVIDENCE/resume.txt"
sleep 3
adb shell pidof "$APP" | tee "$EVIDENCE/pid.txt"

# Restore emulator display settings even if the screenshot step fails.
adb shell wm size 360x800
adb shell wm density 320
adb exec-out screencap -p > "$EVIDENCE/compact.png" 2>/dev/null || true
adb shell wm size reset
adb shell wm density reset
adb logcat -d -b crash > "$EVIDENCE/crash-log.txt" 2>&1 || true
if grep -Fq 'Process: app.lovable.rasd' "$EVIDENCE/crash-log.txt"; then
  echo "::error::Rasd Android process crashed; see crash-log.txt."
  exit 1
fi
echo "PASS: login UI observed, lifecycle survived background, compact screenshot captured."
