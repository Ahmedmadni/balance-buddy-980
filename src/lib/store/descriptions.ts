// =============================================================
// PART 4 — Store description copy
// -------------------------------------------------------------
// Real marketing copy grounded in the app's actual shipped feature set
// (see NAV in src/routes/_authenticated/route.tsx: dashboard, people/
// debts, wallets, expenses, recurring, investments/assets, zakat,
// reports, events, contacts, settings) — no invented features (no
// bank-sync, no multi-currency claims, no team/collaboration claims).
// Character limits enforced by validateStoreCopyLengths() below:
// Google Play short description ≤80, full description ≤4000;
// Apple subtitle ≤30, promotional text ≤170.
// =============================================================

export const GOOGLE_PLAY_TITLE = "رصد — إدارة الأموال والزكاة";

export const GOOGLE_PLAY_SHORT_DESCRIPTION =
  "رصد: محفظتك، مصاريفك، ديونك، واستثماراتك في تطبيق واحد";

export const GOOGLE_PLAY_FULL_DESCRIPTION = `رصد تطبيق شخصي لإدارة أموالك بالكامل — بلا حسابات بنكية مربوطة، وبلا تتبع خارجي.

المحافظ والمصاريف
سجّل محافظك (نقدي، بنكي، محفظة إلكترونية) وتابع كل حركة دخل ومصروف عليها، مع تصنيفات قابلة للتخصيص وسجل كامل لكل حركة.

الديون والأشخاص
تابع من يدين لك ومن تدين له، مع سجل تسويات لكل شخص وربطه بجهات اتصال جهازك.

المصاريف المتكررة
سجّل الالتزامات الدورية (إيجار، اشتراكات، فواتير) واحصل على تذكير قبل موعد استحقاقها.

الأصول والاستثمارات (دفتر أصول موحّد)
سجّل أي أصل — سيارة، عقار، ذهب، أسهم، عملات رقمية، صناديق، أو أصل مخصّص — وتابع قيمته الدفترية والسوقية، والإهلاك، والأرباح المحقّقة وغير المحقّقة من سجل حركاته.

حاسبة الزكاة
احسب زكاتك بدقة حسب نوع كل أصل وغرضه (تجاري أو شخصي)، مع تتبّع تاريخ الحول الهجري والميلادي لكل أصل.

التقارير وكشف الحساب
اطّلع على تقارير مالية شاملة وصدّر كشف حساب لأي محفظة (PDF أو Excel).

التذكيرات والأحداث
لا تفوّت موعد سداد أو تجديد — تذكيرات ذكية لكل التزاماتك المالية.

الخصوصية أولاً
بياناتك مخزّنة في حسابك السحابي الخاص، محمية بصلاحيات وصول صارمة (Row Level Security) — لا مشاركة بيانات مع أي جهة تحليلات خارجية. نسخ احتياطي واستيراد/تصدير كامل لبياناتك في أي وقت.

مصمّم بالعربية، من اليمين لليسار، لتجربة طبيعية بالكامل.`;

export const APPLE_SUBTITLE = "إدارة أموالك وزكاتك بسهولة";

export const APPLE_PROMOTIONAL_TEXT =
  "تابع محافظك ومصاريفك وديونك واستثماراتك واحسب زكاتك — كل شيء في مكان واحد، بخصوصية تامة.";

export const STORE_CATEGORY_GOOGLE_PLAY = "Finance";
export const STORE_CATEGORY_APPLE = "Finance";

export const STORE_KEYWORDS = [
  "إدارة أموال",
  "مصاريف",
  "ميزانية",
  "ديون",
  "زكاة",
  "استثمار",
  "محفظة",
  "تذكير مصاريف",
  "تقارير مالية",
  "أصول",
];

export interface StoreCopyLengthCheck {
  id: string;
  label: string;
  length: number;
  limit: number;
  withinLimit: boolean;
}

export function validateStoreCopyLengths(): StoreCopyLengthCheck[] {
  const checks: { id: string; label: string; value: string; limit: number }[] = [
    { id: "store_title", label: "Store Title", value: GOOGLE_PLAY_TITLE, limit: 30 },
    {
      id: "google_short_description",
      label: "Google Play Short Description",
      value: GOOGLE_PLAY_SHORT_DESCRIPTION,
      limit: 80,
    },
    {
      id: "google_full_description",
      label: "Google Play Full Description",
      value: GOOGLE_PLAY_FULL_DESCRIPTION,
      limit: 4000,
    },
    { id: "apple_subtitle", label: "Apple Subtitle", value: APPLE_SUBTITLE, limit: 30 },
    {
      id: "apple_promotional_text",
      label: "Apple Promotional Text",
      value: APPLE_PROMOTIONAL_TEXT,
      limit: 170,
    },
  ];

  return checks.map((c) => ({
    id: c.id,
    label: c.label,
    length: c.value.length,
    limit: c.limit,
    withinLimit: c.value.length <= c.limit,
  }));
}
