// =============================================================
// PART 1 — verifyAndroidSigning()
// -------------------------------------------------------------
// STATIC facts verified by reading the repo directly (2026-07-04):
// there is no android/ directory in this project at all (Capacitor
// platform never added — see release/android-audit.ts), so no
// keystore, no keystore.properties, no signingConfigs block in any
// build.gradle can exist yet. Nothing here can be a live filesystem
// check (browsers can't read a keystore file), so this mirrors the
// session's established static-fact convention rather than faking a
// runtime probe.
// =============================================================
import type { HealthStatus } from "@/lib/system/health";

const ANDROID_PLATFORM_EXISTS = false; // no android/ directory in this repo

export interface AndroidSigningStatus {
  hasKeystore: boolean;
  hasAlias: boolean;
  hasReleaseSigningConfig: boolean;
  hasSHA1: boolean;
  hasSHA256: boolean;
  status: HealthStatus;
  detail: string;
}

export async function verifyAndroidSigning(): Promise<AndroidSigningStatus> {
  return {
    hasKeystore: false,
    hasAlias: false,
    hasReleaseSigningConfig: false,
    hasSHA1: false,
    hasSHA256: false,
    status: "error",
    detail: ANDROID_PLATFORM_EXISTS
      ? "منصّة android/ موجودة لكن لا keystore توقيع بعد"
      : "لا منصّة android/ مضافة إطلاقاً — لا يمكن وجود keystore/alias/signingConfig/SHA1/SHA256 قبل bun run android:add ثم توليد keystore يدوياً (راجع MOBILE_BUILD.md)",
  };
}
