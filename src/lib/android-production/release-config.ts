// =============================================================
// PART 1 — auditAndroidReleaseConfig()
// -------------------------------------------------------------
// allowMixedContent/cleartext/liveReload/debugFlags are STATIC facts
// verified by reading capacitor.config.ts directly (2026-07-04) — the
// actual single source of truth for these settings. minify/
// shrinkResources/proguard/versionCode live in android/app/build.gradle,
// which doesn't exist yet (no android/ platform added) — reported
// honestly as not_applicable rather than guessed. versionName mirrors
// APP_VERSION (package.json), the same source release/android-audit.ts
// already uses.
// =============================================================
import { APP_VERSION } from "@/lib/mobile/version";
import type { HealthStatus } from "@/lib/system/health";

// Verified 2026-08-13 by reading capacitor.config.ts directly. The config is
// now CAP_ENV-conditional: these constants describe the PRODUCTION branch
// (CAP_ENV=production), which is what a release AAB is built with.
const ALLOW_MIXED_CONTENT = false; // android.allowMixedContent (!isProduction)
const CLEARTEXT_TRAFFIC = false; // server.cleartext (production branch)
const LIVE_RELOAD_ACTIVE = false; // production loads the published HTTPS domain
const DEBUG_FLAGS_ENABLED = false; // android.webContentsDebuggingEnabled
const ANDROID_PLATFORM_EXISTS = false; // no android/ directory — no build.gradle yet

export interface AndroidReleaseConfigItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface AndroidReleaseConfig {
  items: AndroidReleaseConfigItem[];
  score: number;
  generatedAt: string;
}

export function auditAndroidReleaseConfig(): AndroidReleaseConfig {
  const items: AndroidReleaseConfigItem[] = [
    {
      id: "allow_mixed_content",
      label: "allowMixedContent",
      status: ALLOW_MIXED_CONTENT ? "error" : "ok",
      detail: ALLOW_MIXED_CONTENT
        ? "true في capacitor.config.ts — يجب ضبطه false قبل بناء AAB للنشر"
        : "false — صحيح للإنتاج",
    },
    {
      id: "live_reload",
      label: "Live Reload",
      status: LIVE_RELOAD_ACTIVE ? "error" : "ok",
      detail: LIVE_RELOAD_ACTIVE
        ? "كائن server في capacitor.config.ts لا يزال يشير لرابط Lovable sandbox — يجب تعليقه/حذفه قبل النشر"
        : "معطَّل في وضع الإنتاج — يحمّل الدومين المنشور عبر HTTPS (CAP_SERVER_URL)",
    },
    {
      id: "cleartext_traffic",
      label: "Cleartext Traffic",
      status: CLEARTEXT_TRAFFIC ? "error" : "ok",
      detail: CLEARTEXT_TRAFFIC
        ? "server.cleartext: true — مرتبط مباشرة بوضع Live Reload، يُحذف معه"
        : "false — صحيح للإنتاج",
    },
    {
      id: "debug_flags",
      label: "Debug Flags",
      status: DEBUG_FLAGS_ENABLED ? "warning" : "ok",
      detail: DEBUG_FLAGS_ENABLED
        ? "webContentsDebuggingEnabled: true — يجب تعطيله للإنتاج"
        : "webContentsDebuggingEnabled: false — صحيح للإنتاج",
    },
    {
      id: "minify",
      label: "Minify",
      status: "warning",
      detail: ANDROID_PLATFORM_EXISTS
        ? "يُضبط في android/app/build.gradle"
        : "غير قابل للتطبيق بعد — لا android/app/build.gradle موجود (لا منصّة مضافة)",
    },
    {
      id: "shrink_resources",
      label: "Shrink Resources",
      status: "warning",
      detail: ANDROID_PLATFORM_EXISTS
        ? "يُضبط في android/app/build.gradle"
        : "غير قابل للتطبيق بعد — لا android/app/build.gradle موجود (لا منصّة مضافة)",
    },
    {
      id: "proguard",
      label: "ProGuard",
      status: "warning",
      detail: ANDROID_PLATFORM_EXISTS
        ? "يُضبط في android/app/build.gradle + proguard-rules.pro"
        : "غير قابل للتطبيق بعد — لا android/app/build.gradle موجود (لا منصّة مضافة)",
    },
    {
      id: "version_code",
      label: "VersionCode",
      status: "warning",
      detail: ANDROID_PLATFORM_EXISTS
        ? "يُضبط يدوياً في android/app/build.gradle، ويُرفَع (+1) مع كل رفعة"
        : "غير قابل للتطبيق بعد — لا android/app/build.gradle موجود (لا منصّة مضافة)",
    },
    {
      id: "version_name",
      label: "VersionName",
      status: "ok",
      detail: `${APP_VERSION} (من package.json) — سيُطابَق يدوياً مع versionName في build.gradle عند إضافة المنصّة`,
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
