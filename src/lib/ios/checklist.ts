// =============================================================
// PART 3 — iOS submission checklist (App Store Connect specifics)
// -------------------------------------------------------------
// Mirrors android/checklist.ts's shape/intent for the Apple side.
// =============================================================
export interface IOSSubmissionChecklistItem {
  id: string;
  label: string;
  manual: boolean;
  detail: string;
}

export interface IOSSubmissionChecklist {
  items: IOSSubmissionChecklistItem[];
  generatedAt: string;
}

export function generateIOSSubmissionChecklist(): IOSSubmissionChecklist {
  const items: IOSSubmissionChecklistItem[] = [
    {
      id: "store_listing",
      label: "قائمة App Store",
      manual: true,
      detail:
        "العنوان الفرعي والوصف الترويجي جاهزان في src/lib/store/metadata.ts — تُلصق يدوياً في App Store Connect",
    },
    {
      id: "app_privacy_questionnaire",
      label: "استبيان خصوصية التطبيق",
      manual: true,
      detail:
        "App Privacy details يُعبَّأ داخل App Store Connect استناداً لـ compliance/privacy-policy.ts",
    },
    {
      id: "age_rating",
      label: "تصنيف العمر",
      manual: true,
      detail: "تطبيق مالي للبالغين — يُحدَّد يدوياً في App Store Connect",
    },
    {
      id: "export_compliance",
      label: "امتثال التصدير (تشفير)",
      manual: true,
      detail: "HTTPS القياسي فقط (Supabase) — عادة يُصنَّف كإعفاء قياسي، يُؤكَّد يدوياً عند الرفع",
    },
    {
      id: "screenshots_all_sizes",
      label: "لقطات شاشة لكل أحجام الأجهزة",
      manual: true,
      detail: 'iPhone 6.7"، 6.5"، iPad 12.9" — إلزامية جميعها من Apple',
    },
  ];

  return { items, generatedAt: new Date().toISOString() };
}
