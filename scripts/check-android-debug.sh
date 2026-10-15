#!/usr/bin/env bash
# Validate generated Android debug APK metadata and signature (not OAuth).
set -euo pipefail
APK="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
: "${ANDROID_HOME:?Android SDK is missing}"
[[ -s "$APK" ]] || { echo "Missing APK: $APK" >&2; exit 1; }
TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
[[ -x "$TOOLS/aapt" && -x "$TOOLS/apksigner" ]] || { echo "Android aapt/apksigner unavailable" >&2; exit 1; }
BADGING="$("$TOOLS/aapt" dump badging "$APK")"
printf '%s\n' "$BADGING" | grep -q "^package: name='app.lovable.rasd'"
printf '%s\n' "$BADGING" | grep -Eq "^sdkVersion:'[0-9]+'"
printf '%s\n' "$BADGING" | grep -Eq "^targetSdkVersion:'[0-9]+'"
"$TOOLS/apksigner" verify --verbose "$APK"
if unzip -Z -1 "$APK" | grep -Eq '(^|/)(\.env(\.|$)|keystore\.properties$|[^/]+\.(jks|keystore|pem|p12)$)'; then
  echo "Potential secret material found inside APK" >&2
  exit 1
fi
echo "Verified Android package, SDK version metadata, signature and artifact exclusions."
