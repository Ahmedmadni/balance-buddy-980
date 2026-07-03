// =============================================================
// PART 3 — auditIOSRelease()
// -------------------------------------------------------------
// This project has NO iOS-specific setup at all — no ios/ native
// folder, no `ios:` block in capacitor.config.ts, and MOBILE_BUILD.md
// documents Android only (verified 2026-07-03). Every check below
// reflects that honestly instead of assuming iOS parity with Android.
// AdMob IDs reuse the Ads Audit engine directly.
// =============================================================
import { auditAdsConfiguration } from "@/lib/ads/audit";
import type { HealthStatus } from "@/lib/system/health";

// Static fact verified 2026-07-03: no ios/ directory, no `ios:` key in capacitor.config.ts.
const PACKAGE_NAME_MIRROR = "app.lovable.rasd"; // same appId Capacitor would use as the iOS Bundle ID

export interface IOSReleaseCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface IOSReleaseAuditReport {
  items: IOSReleaseCheckItem[];
  readyCount: number;
  totalCount: number;
  score: number;
  generatedAt: string;
}

export function auditIOSRelease(): IOSReleaseAuditReport {
  const adsAudit = auditAdsConfiguration();

  const items: IOSReleaseCheckItem[] = [
    {
      id: "bundle_identifier",
      label: "Bundle Identifier",
      status: "warning",
      detail: `سيُستخدم ${PACKAGE_NAME_MIRROR} نفسه كـ Bundle ID عند إضافة منصّة iOS (نفس appId في capacitor.config.ts) — لا مشروع Xcode فعلي بعد`,
    },
    {
      id: "version",
      label: "Version",
      status: "warning",
      detail:
        "سيُطابق إصدار package.json (نفس مصدر Android) بعد إضافة المنصّة — لا CFBundleShortVersionString فعلي بعد",
    },
    {
      id: "build_number",
      label: "Build Number",
      status: "warning",
      detail: "لا CFBundleVersion فعلي بعد — سيُضبط يدوياً في Xcode/Info.plist عند إضافة المنصّة",
    },
    {
      id: "app_icons",
      label: "App Icons",
      status: "warning",
      detail:
        "مصدر resources/icon.png (1024×1024) صالح لتوليد مجموعة أيقونات iOS تلقائياً بعد إضافة المنصّة، لكن لم تُولَّد بعد",
    },
    {
      id: "launch_screen",
      label: "Launch Screen",
      status: "warning",
      detail:
        "مصدر resources/splash.png صالح، لكن لا LaunchScreen.storyboard فعلي بعد — يُولَّد عند إضافة المنصّة",
    },
    {
      id: "info_plist",
      label: "Info.plist",
      status: "error",
      detail:
        "لا يوجد ملف Info.plist بتاتاً — لم تُضَف منصّة iOS إطلاقاً في هذا المشروع، ولا خطوات iOS موثَّقة بعد في MOBILE_BUILD.md (يحتاج جهاز macOS + Xcode + حساب Apple Developer)",
    },
    {
      id: "permissions",
      label: "Permissions",
      status: "warning",
      detail:
        "لا صلاحيات حسّاسة إجبارية حالياً في الكود؛ نصوص الاستخدام (مثل NSCameraUsageDescription) ستحتاج إضافة يدوية في Info.plist عند إنشائه إن استُخدمت الكاميرا مستقبلاً",
    },
    {
      id: "ats_policy",
      label: "ATS Policy (App Transport Security)",
      status: "warning",
      detail:
        "لا Info.plist بعد لضبط NSAppTransportSecurity؛ Supabase Cloud يعمل عبر HTTPS بالكامل فلا حاجة متوقّعة لاستثناءات ATS عند الإعداد",
    },
    {
      id: "admob_ids",
      label: "AdMob IDs",
      status: adsAudit.ios.configured ? "ok" : "warning",
      detail: adsAudit.ios.detail,
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
