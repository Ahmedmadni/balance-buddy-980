// =============================================================
// PART 5 — auditConsentReadiness()
// -------------------------------------------------------------
// Ads Consent reuses mobile/readiness.ts's own "consent_ready" item
// (single source of truth, already honestly hardcoded to "warning"
// there since no consent SDK exists by design). Analytics/Tracking
// Consent are "ok" because there is genuinely nothing to consent to —
// both are fully local, verified facts, not assumptions.
// =============================================================
import { generateReleaseChecklist } from "@/lib/mobile/readiness";
import type { HealthStatus } from "@/lib/system/health";

export interface ConsentCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ConsentReadinessReport {
  items: ConsentCheckItem[];
  score: number;
  generatedAt: string;
}

export async function auditConsentReadiness(): Promise<ConsentReadinessReport> {
  const checklist = await generateReleaseChecklist();
  const consentItem = checklist.items.find((i) => i.id === "consent_ready");

  const items: ConsentCheckItem[] = [
    {
      id: "gdpr",
      label: "GDPR",
      status: "error",
      detail:
        "لا آلية Consent Management Platform (CMP) ولا سياسة خصوصية منشورة فعلياً بعد — مطلوبتان قبل استهداف مستخدمين في الاتحاد الأوروبي",
    },
    {
      id: "ccpa",
      label: "CCPA",
      status: "warning",
      detail:
        "لا رابط «Do Not Sell My Personal Information» ولا آلية Opt-Out مخصّصة — لكن التطبيق أصلاً لا يبيع بيانات ولا يحمّل أي SDK إعلانات حقيقي بعد",
    },
    {
      id: "ads_consent",
      label: "Ads Consent",
      status: consentItem?.status ?? "warning",
      detail: consentItem?.detail ?? "غير متاح",
    },
    {
      id: "analytics_consent",
      label: "Analytics Consent",
      status: "ok",
      detail:
        "لا حاجة لموافقة — محرك الرؤى المالية يعمل بالكامل محلياً على بيانات المستخدم نفسه في Supabase، بلا أي SDK تحليلات خارجي أو إرسال بيانات لطرف ثالث",
    },
    {
      id: "tracking_consent",
      label: "Tracking Consent",
      status: "ok",
      detail:
        "لا تتبّع عبر تطبيقات/مواقع أخرى (Cross-App Tracking) — متتبّع جلسات Beta محلي بالكامل في localStorage ولا يُرسَل لأي خادم",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
