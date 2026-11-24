#!/usr/bin/env bash
set -euo pipefail
APP="app.lovable.rasd.local"
APK="${1:?APK required}"
EVIDENCE=android-offline-evidence
mkdir -p "$EVIDENCE"
adb install -r "$APK"
adb shell svc wifi disable || true
adb shell svc data disable || true
adb shell am force-stop "$APP" || true
adb shell am start -W -n "$APP/.MainActivity" > "$EVIDENCE/start.txt" 2>&1
ready=""
for i in $(seq 1 35); do
  adb shell uiautomator dump /sdcard/offline-ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/offline-ui.xml "$EVIDENCE/offline-ui.xml" >/dev/null 2>&1 || true
  if grep -Eq 'إنشاء خزنتك المحلية|كلمة المرور الرئيسية|النسخة المحلية' "$EVIDENCE/offline-ui.xml" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 3
done
adb exec-out screencap -p > "$EVIDENCE/offline-first-launch.png" || true
adb logcat -d -t 2500 > "$EVIDENCE/logcat.txt" || true
if [ -z "$ready" ]; then
  echo "::error::Local Rasd setup UI did not render on Android with all network radios disabled"
  cat "$EVIDENCE/start.txt"
  exit 1
fi
if grep -Eiq 'Edit with Lovable|lovable-badge|متابعة باستخدام جوجل|supabase\.co' "$EVIDENCE/offline-ui.xml"; then
  echo "::error::A cloud login or branding element unexpectedly appeared in fully local Android UI"
  exit 1
fi
echo "PASS: Rasd local-only setup screen renders with network disabled."
