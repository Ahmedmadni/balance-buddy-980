// =============================================================
// PART 5 — generateSupportOperations()
// -------------------------------------------------------------
// Pure documentation of the operational process around support.
// Reuses generateSupportSLA() (Prompt 29) for response-time targets
// and buildDeletionExecutionPlan() (Prompt 29) for the account
// deletion request process rather than redeclaring either. Escalation
// and incident response here are a short summary only — the full
// playbook lives in operations/incidents.ts (PART 6), referenced by
// name to avoid duplicating it.
// =============================================================
import { generateSupportSLA } from "@/lib/support-production/sla";
import { buildDeletionExecutionPlan } from "@/lib/account-deletion/execution-plan";

export interface SupportOperationsSection {
  id: string;
  label: string;
  detail: string;
}

export interface SupportOperationsManual {
  sla: ReturnType<typeof generateSupportSLA>;
  sections: SupportOperationsSection[];
  generatedAt: string;
}

export function generateSupportOperations(): SupportOperationsManual {
  const sla = generateSupportSLA();
  const deletionPlan = buildDeletionExecutionPlan();

  const sections: SupportOperationsSection[] = [
    {
      id: "escalation",
      label: "Escalation",
      detail:
        "3 مستويات: الدعم العام (رد أولي) → مطوّر مسؤول عن الميزة المتأثرة → صاحب المنتج للحوادث الحرجة (راجع تصنيف SLA أعلاه لتحديد المستوى)",
    },
    {
      id: "incident_response",
      label: "Incident Response",
      detail:
        "أي بلاغ يُصنَّف أولاً حسب فئات operations/incidents.ts (مالي/أمني/نسخ احتياطي/إشعارات/مصادقة/تلف بيانات/تعطّل خدمة) قبل تحديد خطوات الاستجابة",
    },
    {
      id: "user_support",
      label: "User Support",
      detail:
        "القناة الوحيدة حالياً: البريد الإلكتروني (support_email) — لا نظام تذاكر مباشر داخل التطبيق بعد",
    },
    {
      id: "legal_requests",
      label: "Legal Requests",
      detail:
        "تُوجَّه لقناة الاتصال القانوني (غير موجودة كقناة منفصلة بعد — تصل حالياً عبر الدعم العام)",
    },
    {
      id: "privacy_requests",
      label: "Privacy Requests",
      detail:
        "طلبات الوصول/التصحيح تُعالَج يدوياً عبر الدعم العام؛ التصدير الذاتي متاح فعلياً من داخل التطبيق (auditUserDataExport())",
    },
    {
      id: "account_deletion_requests",
      label: "Account Deletion Requests",
      detail: `${deletionPlan.categories.length} فئة تنفيذ موثَّقة (auth/storage/database/notification/backup/audit) — بلا تنفيذ فعلي بعد (executable: ${deletionPlan.executable})، يتطلب معالجاً يدوياً حتى تُبنى Edge Function حقيقية`,
    },
  ];

  return {
    sla,
    sections,
    generatedAt: new Date().toISOString(),
  };
}
