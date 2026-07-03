// =============================================================
// PART 2 — auditAndroidRelease()
// -------------------------------------------------------------
// This project has NOT run `bun run android:add` in this environment
// (no android/ directory), so native-file checks (AndroidManifest.xml
// permissions, backup_rules.xml, network_security_config.xml, generated
// adaptive-icon PNGs) can't be read anyway from a browser at runtime.
// The checks below are grounded in what actually drives the native
// build once generated: capacitor.config.ts settings (verified by
// reading that file directly, 2026-07-03) and the source assets in
// resources/. AdMob IDs reuse the Ads Audit engine directly.
// =============================================================
import { auditAdsConfiguration } from "@/lib/ads/audit";
import { APP_VERSION } from "@/lib/mobile/version";
import type { HealthStatus } from "@/lib/system/health";

// Static facts verified 2026-07-03 by reading capacitor.config.ts / resources/ / MOBILE_BUILD.md directly.
const ANDROID_PLATFORM_ADDED = false; // no android/ directory in this repo yet
const PACKAGE_NAME_MIRROR = "app.lovable.rasd";
const HAS_ICON_SOURCE = true; // resources/icon.png (1024x1024)
const HAS_SPLASH_SOURCE = true; // resources/splash.png (2732x2732)
const ALLOW_MIXED_CONTENT = true; // capacitor.config.ts android.allowMixedContent — must be false for production
const LIVE_RELOAD_SERVER_ACTIVE = true; // capacitor.config.ts `server` block is not commented out

export interface AndroidReleaseCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface AndroidReleaseAuditReport {
  items: AndroidReleaseCheckItem[];
  readyCount: number;
  totalCount: number;
  score: number;
  generatedAt: string;
}

export function auditAndroidRelease(): AndroidReleaseAuditReport {
  const adsAudit = auditAdsConfiguration();

  const items: AndroidReleaseCheckItem[] = [
    {
      id: "capacitor_android",
      label: "Capacitor Android Platform",
      status: ANDROID_PLATFORM_ADDED ? "ok" : "warning",
      detail: ANDROID_PLATFORM_ADDED
        ? "منصّة android/ مضافة"
        : "لم تُضَف بعد في هذا المستودع — شغّل bun run android:add (انظر MOBILE_BUILD.md)",
    },
    {
      id: "application_id",
      label: "ApplicationId",
      status: "ok",
      detail: `${PACKAGE_NAME_MIRROR} — سيُستخدم كـ applicationId في android/app/build.gradle عند الإضافة`,
    },
    {
      id: "version_code",
      label: "VersionCode",
      status: "warning",
      detail:
        "يُضبط يدوياً في android/app/build.gradle بعد إنشاء المنصّة — يجب رفعه (+1) مع كل رفعة على Play Console",
    },
    {
      id: "version_name",
      label: "VersionName",
      status: "ok",
      detail: `${APP_VERSION} (من package.json) — تأكد أنه يطابق versionName في build.gradle عند مزامنته`,
    },
    {
      id: "adaptive_icons",
      label: "Adaptive Icons",
      status: HAS_ICON_SOURCE ? "warning" : "error",
      detail: HAS_ICON_SOURCE
        ? "مصدر الأيقونة resources/icon.png (1024×1024) جاهز — تُولَّد الأيقونات التكيّفية فعلياً عبر bun run android:assets بعد إضافة المنصّة"
        : "لا يوجد ملف مصدر للأيقونة",
    },
    {
      id: "splash_screen",
      label: "Splash Screen",
      status: HAS_SPLASH_SOURCE ? "ok" : "error",
      detail: HAS_SPLASH_SOURCE
        ? "مصدر resources/splash.png (2732×2732) جاهز + إعدادات SplashScreen مضبوطة في capacitor.config.ts (مدة 2.5 ثانية، خلفية #0b1220)"
        : "لا يوجد ملف مصدر لشاشة البداية",
    },
    {
      id: "permissions",
      label: "Permissions",
      status: "warning",
      detail:
        "لا صلاحيات جهاز حسّاسة إجبارية في الكود حالياً (لا كاميرا/موقع إجباري) — AndroidManifest.xml يُولَّد تلقائياً عند الإضافة؛ راجعه يدوياً لاستبعاد أي صلاحية زائدة قبل الرفع",
    },
    {
      id: "backup_rules",
      label: "Backup Rules",
      status: "warning",
      detail:
        "ملفات backup_rules.xml / data_extraction_rules.xml تُولَّد افتراضياً من Capacitor عند إضافة المنصّة — لم تُراجَع يدوياً بعد لاستبعاد بيانات حسّاسة من Android Auto Backup",
    },
    {
      id: "network_security",
      label: "Network Security",
      status: ALLOW_MIXED_CONTENT || LIVE_RELOAD_SERVER_ACTIVE ? "error" : "ok",
      detail:
        "allowMixedContent: true وكائن server (Live Reload على sandbox خارجي) لا يزالان نشطين في capacitor.config.ts — كلاهما يجب تعطيله/حذفه قبل بناء AAB للنشر الفعلي (راجع MOBILE_BUILD.md، قسم «إنشاء APK/AAB للنشر»)",
    },
    {
      id: "admob_ids",
      label: "AdMob IDs",
      status: adsAudit.android.configured ? "ok" : "warning",
      detail: adsAudit.android.detail,
    },
  ];

  const readyCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    readyCount,
    totalCount: items.length,
    score: Math.round((readyCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
