// =============================================================
// PART 4 (Prompt 24) — auditConsentManager()
// -------------------------------------------------------------
// Reports on the real local Consent Manager built in consent.ts (not to
// be confused with Prompt 23's auditConsentReadiness(), which audited
// the app's readiness BEFORE this manager existed). Per-category items
// are always "ok" — a category currently un-consented is the manager
// working correctly (safe opt-out default), not a compliance defect;
// only the manager's presence and whether the user has actually been
// asked (bannerShown) affect the score.
// =============================================================
import {
  loadConsent,
  CONSENT_CATEGORIES,
  CONSENT_CATEGORY_LABEL,
  type ConsentRecord,
} from "./consent";
import type { HealthStatus } from "@/lib/system/health";

export interface ConsentAuditItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ConsentAuditReport {
  items: ConsentAuditItem[];
  score: number;
  record: ConsentRecord;
  generatedAt: string;
}

export function auditConsentManager(): ConsentAuditReport {
  const record = loadConsent();

  const items: ConsentAuditItem[] = [
    {
      id: "manager_present",
      label: "مدير الموافقات المحلي",
      status: "ok",
      detail:
        "طبقة Consent محلية بالكامل (localStorage) موجودة وتعمل — لا SDK خارجي، لا اتصال شبكي",
    },
    {
      id: "banner_shown",
      label: "عرض شاشة الموافقة للمستخدم",
      status: record.bannerShown ? "ok" : "warning",
      detail: record.bannerShown
        ? `تم اتخاذ قرار — آخر تحديث ${record.updatedAt}`
        : "لم يُطلَب من المستخدم اتخاذ قرار بعد عبر واجهة فعلية — كل الفئات على false افتراضياً حتى ذلك الحين",
    },
    {
      id: "gdpr",
      label: "GDPR (الاتحاد الأوروبي)",
      status: "warning",
      detail:
        "يوجد خيار موافقة محلي، لكن ذلك لا يثبت الامتثال القانوني. يلزم تقييم الغرض من المعالجة، مزودي الخدمات، وأسس المعالجة والسجلات وحقوق المستخدم قبل الإطلاق.",
    },
    {
      id: "ccpa",
      label: "CCPA (كاليفورنيا)",
      status: "warning",
      detail:
        "الإعدادات المحلية وحدها لا تكفي لتأكيد الالتزام؛ يتوقف التقييم على نطاق التطبيق الفعلي وطبيعة البيانات وأغراض معالجتها والإفصاحات المطلوبة.",
    },
    {
      id: "pdpl",
      label: "PDPL (نظام حماية البيانات الشخصية السعودي)",
      status: "warning",
      detail:
        "الموافقة خيار تقني فقط ولا تعني اكتمال متطلبات نظام حماية البيانات الشخصية السعودي؛ يلزم توثيق الجهات والأغراض ومدد الاحتفاظ وحقوق الأفراد والتحقق من إعدادات الإنتاج.",
    },
  ];

  for (const cat of CONSENT_CATEGORIES) {
    items.push({
      id: `category_${cat}`,
      label: CONSENT_CATEGORY_LABEL[cat],
      status: "ok",
      detail: record.categories[cat]
        ? "موافَق عليها من المستخدم"
        : "غير مُوافَق عليها (الافتراضي الآمن)",
    });
  }

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    record,
    generatedAt: new Date().toISOString(),
  };
}
