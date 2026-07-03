// =============================================================
// PART 6 — auditCompliance()
// -------------------------------------------------------------
// Ads Consent reuses the Ads Audit's own release checklist item
// (mobile/readiness.ts's "consent_ready" — the single source of truth
// for that fact, already honestly hardcoded to "warning" there since
// no consent SDK exists by design). Data Export reuses the Backup
// Engine. Data Deletion is a real, verified gap: this app has no
// account/full-data-deletion feature (only per-record delete).
// =============================================================
import { PRIVACY_POLICY_URL, TERMS_URL, isPlaceholderUrl } from "./metadata-config";
import { loadLastBackup } from "@/lib/backup/engine";
import { generateReleaseChecklist } from "@/lib/mobile/readiness";
import type { HealthStatus } from "@/lib/system/health";

export interface ComplianceCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ComplianceAuditReport {
  items: ComplianceCheckItem[];
  score: number;
  generatedAt: string;
}

export async function auditCompliance(): Promise<ComplianceAuditReport> {
  const [lastBackup, checklist] = await Promise.all([loadLastBackup(), generateReleaseChecklist()]);
  const consentItem = checklist.items.find((i) => i.id === "consent_ready");

  const privacyReady = !isPlaceholderUrl(PRIVACY_POLICY_URL);
  const termsReady = !isPlaceholderUrl(TERMS_URL);

  const items: ComplianceCheckItem[] = [
    {
      id: "gdpr",
      label: "GDPR",
      status: privacyReady && consentItem?.status === "ok" ? "ok" : "error",
      detail:
        "يتطلب سياسة خصوصية حقيقية + آلية موافقة فعلية على الإعلانات (Consent) — كلاهما غير مكتمل حالياً",
    },
    {
      id: "ccpa",
      label: "CCPA",
      status: privacyReady ? "warning" : "error",
      detail:
        "يتطلب سياسة خصوصية تذكر صراحة حقوق مستخدمي كاليفورنيا (Do Not Sell My Info) — لم تُكتب بعد",
    },
    {
      id: "privacy_policy",
      label: "Privacy Policy",
      status: privacyReady ? "ok" : "error",
      detail: privacyReady
        ? "رابط مُعدّ"
        : "PRIVACY_POLICY_URL لا يزال placeholder في metadata-config.ts",
    },
    {
      id: "terms_of_service",
      label: "Terms of Service",
      status: termsReady ? "ok" : "error",
      detail: termsReady ? "رابط مُعدّ" : "TERMS_URL لا يزال placeholder في metadata-config.ts",
    },
    {
      id: "ads_consent",
      label: "Ads Consent",
      status: consentItem?.status ?? "warning",
      detail: consentItem?.detail ?? "غير متاح",
    },
    {
      id: "data_export",
      label: "Data Export",
      status: "ok",
      detail:
        "متاح فعلياً عبر محرك النسخ الاحتياطي (Settings > النسخ الاحتياطي → تصدير JSON) — يغطي كل بيانات المستخدم",
    },
    {
      id: "data_deletion",
      label: "Data Deletion",
      status: "error",
      detail:
        "لا آلية لحذف الحساب/كل بيانات المستخدم دفعة واحدة — يوجد فقط حذف عناصر فردية (محفظة/عملية/أصل)؛ GDPR/CCPA يتطلبان هذا الحق صراحة",
    },
    {
      id: "backup_policy",
      label: "Backup Policy",
      status: lastBackup ? "ok" : "warning",
      detail: lastBackup
        ? `آخر نسخة بتاريخ ${lastBackup.meta.exported_at} — النسخ يدوي ومحلي بالكامل (لا مزامنة سحابية تلقائية)`
        : "لا نسخة احتياطية محلية بعد؛ التصدير يدوي بالكامل ولا مزامنة سحابية تلقائية",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
