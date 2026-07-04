// =============================================================
// PART 6 — generateSupportSLA()
// -------------------------------------------------------------
// Pure documentation — target response times for a future support
// process. This app has no ticketing system today (feedback is
// localStorage-only, see ux/feedback.ts), so these are proposed
// targets to adopt once a real support channel exists, not
// measurements of an existing process.
// =============================================================
export interface SupportSLATier {
  id: string;
  category: string;
  targetFirstResponseHours: number;
  targetResolutionHours: number;
  detail: string;
}

export interface SupportSLA {
  tiers: SupportSLATier[];
  note: string;
  generatedAt: string;
}

export function generateSupportSLA(): SupportSLA {
  const tiers: SupportSLATier[] = [
    {
      id: "critical",
      category: "حرج (فقدان بيانات، تعطّل كامل)",
      targetFirstResponseHours: 4,
      targetResolutionHours: 24,
      detail: "أعلى أولوية — يشمل شكاوى فقدان بيانات مالية أو تعطّل تسجيل الدخول",
    },
    {
      id: "high",
      category: "عالي (خلل وظيفي غير حرج)",
      targetFirstResponseHours: 24,
      targetResolutionHours: 72,
      detail: "خلل في ميزة لا يمنع الاستخدام العام للتطبيق",
    },
    {
      id: "normal",
      category: "عادي (استفسار، طلب ميزة)",
      targetFirstResponseHours: 48,
      targetResolutionHours: 168,
      detail: "استفسارات عامة، اقتراحات، طلبات ميزات",
    },
    {
      id: "privacy_legal",
      category: "خصوصية/قانوني (طلب حذف/تصدير بيانات)",
      targetFirstResponseHours: 24,
      targetResolutionHours: 720,
      detail: "يتماشى مع مهلة الـ30 يوماً الشائعة في GDPR/PDPL لطلبات حقوق البيانات",
    },
  ];

  return {
    tiers,
    note: "أهداف مقترحة لعملية دعم مستقبلية — لا نظام تذاكر دعم فعلي قائم بعد لقياس الالتزام بها",
    generatedAt: new Date().toISOString(),
  };
}
