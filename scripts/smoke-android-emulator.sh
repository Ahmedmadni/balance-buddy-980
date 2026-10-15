#!/usr/bin/env bash
# Android emulator smoke: confirms installation and launch, NOT Google OAuth.
set -euo pipefail
APK="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
[[ -s "$APK" ]] || { echo "APK missing" >&2; exit 1; }
mkdir -p android-smoke-output
adb wait-for-device
adb install -r "$APK"
adb shell am start -n app.lovable.rasd/.MainActivity
sleep 12
pid="$(adb shell pidof app.lovable.rasd | tr -d '\r' | awk '{print $1}')"
[[ -n "$pid" ]] || {
  adb logcat -d -t 300 | tail -n 80
  echo "Rasd Android process stopped after launch" >&2
  exit 1
}
echo "Rasd package installed and process launched: PID $pid"
adb shell screencap -p /sdcard/rasd-smoke.png
adb pull /sdcard/rasd-smoke.png android-smoke-output/rasd-smoke.png
adb logcat -d -t 600 > android-smoke-output/last-logcat.txt
# Probe that the package is still alive after capturing the screen.
adb shell pidof app.lovable.rasd >/dev/null
echo "Emulator smoke passed; Google sign-in and Supabase operations remain unverified."
