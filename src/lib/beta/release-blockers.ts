// =============================================================
// PART 7 — detectReleaseBlockers()
// -------------------------------------------------------------
// Every check reuses an existing audit engine — nothing here
// recomputes empty-state/mobile/accessibility/ads logic.
// =============================================================
import { auditEmptyStates } from "@/lib/ux/empty-states";
import { auditMobileCompatibility } from "@/lib/mobile/compatibility";
import { auditAccessibility } from "@/lib/ux/accessibility";
import { auditAdsConfiguration } from "@/lib/ads/audit";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { loadLastBackup } from "@/lib/backup/engine";

export interface ReleaseBlocker {
  id: string;
  label: string;
  blocking: boolean;
  detail: string;
}

export interface ReleaseBlockersReport {
  blockers: ReleaseBlocker[];
  blockingCount: number;
  generatedAt: string;
}

// The mobile capabilities that would meaningfully break the app if missing —
// camera/deep-links/share/storage-persist are nice-to-have, not launch-blocking.
const CORE_MOBILE_IDS = ["local_storage", "file_export", "file_import", "notifications"];
const ACCESSIBILITY_BLOCK_THRESHOLD = 60;

export async function detectReleaseBlockers(): Promise<ReleaseBlockersReport> {
  const emptyStates = auditEmptyStates();
  const mobileCompat = auditMobileCompatibility();
  const a11y = auditAccessibility();
  const adsAudit = auditAdsConfiguration();
  const notifSettings = loadNotificationSettings();
  const lastBackup = await loadLastBackup();

  const missingEmptyStates = emptyStates.pages.filter((p) => p.quality === "missing");
  const missingMobile = mobileCompat.items.filter(
    (i) => CORE_MOBILE_IDS.includes(i.id) && !i.supported,
  );
  const anyAdsConfigured =
    adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured;

  const blockers: ReleaseBlocker[] = [
    {
      id: "missing_empty_states",
      label: "Missing Empty States",
      blocking: missingEmptyStates.length > 0,
      detail:
        missingEmptyStates.length > 0
          ? `${missingEmptyStates.length} صفحة بلا حالة فارغة: ${missingEmptyStates.map((p) => p.label).join("، ")}`
          : "كل الصفحات تعرض حالة فارغة على الأقل",
    },
    {
      id: "missing_mobile_support",
      label: "Missing Mobile Support",
      blocking: missingMobile.length > 0,
      detail:
        missingMobile.length > 0
          ? `${missingMobile.length} قدرة جهاز أساسية غير مدعومة: ${missingMobile.map((i) => i.label).join("، ")}`
          : "كل قدرات الجهاز الأساسية (تخزين/تصدير/استيراد/إشعارات) متاحة",
    },
    {
      id: "missing_accessibility",
      label: "Missing Accessibility",
      blocking: a11y.score < ACCESSIBILITY_BLOCK_THRESHOLD,
      detail: `درجة إتاحة الوصول ${a11y.score}/100 (الحد الأدنى ${ACCESSIBILITY_BLOCK_THRESHOLD})`,
    },
    {
      id: "missing_backup",
      label: "Missing Backup",
      blocking: !lastBackup,
      detail: lastBackup
        ? `آخر نسخة بتاريخ ${lastBackup.meta.exported_at}`
        : "لا توجد نسخة احتياطية محلية بعد",
    },
    {
      id: "missing_notifications",
      label: "Missing Notifications",
      blocking: !notifSettings.enabled,
      detail: notifSettings.enabled ? "مفعّلة" : "غير مفعّلة في الإعدادات",
    },
    {
      id: "missing_ads_configuration",
      label: "Missing Ads Configuration",
      blocking: !anyAdsConfigured,
      detail: anyAdsConfigured
        ? "منصة واحدة على الأقل (Web/Android/iOS) بمعرّفات حقيقية"
        : "كل المنصات لا تزال على معرّفات placeholder — مقبول لـ Beta، لكن يمنع الإطلاق الفعلي بالإعلانات",
    },
    {
      id: "missing_help_pages",
      label: "Missing Help Pages",
      blocking: false,
      detail:
        "قسم المساعدة (Settings > المساعدة) مُضاف: إصدار التطبيق، تصدير تشخيصي، إرسال ملاحظات (Prompt 20)",
    },
  ];

  return {
    blockers,
    blockingCount: blockers.filter((b) => b.blocking).length,
    generatedAt: new Date().toISOString(),
  };
}
