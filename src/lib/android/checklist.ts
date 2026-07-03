// =============================================================
// PART 2 — Android submission checklist (Play Console specifics)
// -------------------------------------------------------------
// Distinct from release.ts's technical build steps: this is the
// store-listing/compliance checklist specific to Play Console, items
// that cannot be verified from this sandbox (no Play Console account
// connected) so are honestly reported as "manual" rather than probed.
// =============================================================
export interface AndroidSubmissionChecklistItem {
  id: string;
  label: string;
  manual: boolean;
  detail: string;
}

export interface AndroidSubmissionChecklist {
  items: AndroidSubmissionChecklistItem[];
  generatedAt: string;
}

export function generateAndroidSubmissionChecklist(): AndroidSubmissionChecklist {
  const items: AndroidSubmissionChecklistItem[] = [
    {
      id: "store_listing",
      label: "قائمة المتجر",
      manual: true,
      detail:
        "العنوان والوصف القصير/الكامل جاهزان في src/lib/store/metadata.ts — تُلصق يدوياً في Play Console",
    },
    {
      id: "content_rating",
      label: "تصنيف المحتوى (IARC)",
      manual: true,
      detail: "استبيان تصنيف المحتوى يُعبَّأ داخل Play Console مباشرة — لا يمكن أتمتته",
    },
    {
      id: "data_safety_form",
      label: "نموذج أمان البيانات",
      manual: true,
      detail: "يعتمد على compliance/privacy-policy.ts لتحديد أنواع البيانات المجمّعة فعلياً",
    },
    {
      id: "target_audience",
      label: "الجمهور المستهدف والمحتوى",
      manual: true,
      detail: "تطبيق مالي للبالغين — يُحدَّد يدوياً في Play Console",
    },
    {
      id: "pricing_distribution",
      label: "التسعير والتوزيع",
      manual: true,
      detail: "مجاني، الدول المستهدفة تُحدَّد يدوياً في Play Console",
    },
  ];

  return { items, generatedAt: new Date().toISOString() };
}
