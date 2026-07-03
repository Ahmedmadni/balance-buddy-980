// =============================================================
// PART 2 — generateTermsOfService()
// -------------------------------------------------------------
// Generates real terms TEXT (not an audit), grounded in what this app
// actually does today: no real subscription/billing exists yet
// ("Premium" is a local preference that only hides ad placements), no
// automatic cloud backup, ad architecture is AdSense/AdMob placeholders.
// A draft to review with a lawyer before publishing — stated explicitly.
// =============================================================
import { PRIVACY_POLICY_URL } from "@/lib/release/metadata-config";

const APP_NAME = "رصد";

export interface TermsSection {
  id: string;
  title: string;
  body: string;
}

export interface GeneratedTermsOfService {
  sections: TermsSection[];
  markdown: string;
  generatedAt: string;
}

export function generateTermsOfService(): GeneratedTermsOfService {
  const sections: TermsSection[] = [
    {
      id: "acceptable_use",
      title: "الاستخدام المقبول",
      body: `يُستخدَم ${APP_NAME} لإدارة الشؤون المالية الشخصية فقط. يُمنَع استخدامه لأي غرض غير قانوني، أو محاولة الوصول غير المصرَّح به لحسابات أو بيانات مستخدمين آخرين، أو استغلال أي ثغرة في النظام.`,
    },
    {
      id: "liability",
      title: "حدود المسؤولية",
      body: `${APP_NAME} أداة مساعدة لإدارة الأموال وتتبّعها، ولا يُعَدّ استشارة مالية أو شرعية مُلزِمة (بما في ذلك حسابات الزكاة المعروضة في التطبيق). أنت المسؤول الوحيد عن دقة البيانات المُدخَلة وعن أي قرار مالي يُبنى على مخرجات التطبيق. راجع أيضاً سياسة الخصوصية: ${PRIVACY_POLICY_URL}.`,
    },
    {
      id: "backup_responsibility",
      title: "النسخ الاحتياطي ومسؤوليتك",
      body: `يوفّر التطبيق أداة تصدير نسخة احتياطية يدوية من الإعدادات — لكن الاحتفاظ بنسخ محدَّثة من بياناتك مسؤوليتك أنت. لا يوجد نسخ احتياطي تلقائي أو مزامنة سحابية في هذا الإصدار.`,
    },
    {
      id: "data_loss",
      title: "فقدان البيانات",
      body: `رغم الاعتماد على بنية تحتية موثوقة (Supabase)، لا يضمن ${APP_NAME} عدم حدوث فقدان بيانات ناتج عن عطل تقني أو انقطاع خدمة أو خطأ من المستخدم (مثل حذف عملية بالخطأ، فلا يوجد استرجاع بعد الحذف). يُنصح بأخذ نسخة احتياطية دورية.`,
    },
    {
      id: "ads",
      title: "الإعلانات",
      body: `قد تُعرَض إعلانات من Google AdSense (الويب) أو Google AdMob (الجوال) في النسخة غير المدفوعة من التطبيق. يمكن تعطيلها بالكامل عبر تفعيل وضع Premium من الإعدادات. لا يتحمّل ${APP_NAME} مسؤولية محتوى الإعلانات المعروضة من طرف ثالث.`,
    },
    {
      id: "future_subscriptions",
      title: "الاشتراكات المستقبلية",
      body: `لا يوجد حالياً أي اشتراك مدفوع أو نظام فوترة فعلي — وضع "Premium" الحالي مجرد تفضيل محلي على جهازك يُخفي الإعلانات فقط، بلا أي عملية دفع. إن أُضيف اشتراك حقيقي مستقبلاً، سيُحدَّث هذا القسم ليشمل شروط الفوترة والتجديد والإلغاء والاسترداد قبل تفعيله.`,
    },
    {
      id: "termination",
      title: "إنهاء الحساب",
      body: `يمكنك التوقف عن استخدام ${APP_NAME} في أي وقت. لطلب حذف حسابك وبياناته بالكامل، افتح "حذف الحساب" من الإعدادات (يعرض معاينة كاملة للبيانات المتأثرة قبل أي تأكيد) أو تواصل مع الدعم.`,
    },
    {
      id: "changes",
      title: "تعديلات على الشروط",
      body: `قد تُحدَّث هذه الشروط مع تطوّر التطبيق وميزاته. يُنصَح بمراجعتها دورياً.`,
    },
  ];

  const disclaimer =
    "> **مسودة تلقائية** — هذا النص مُولَّد من الحالة الفعلية للتطبيق وقت الإنشاء، وليس استشارة قانونية. راجعها مع مختص قانوني قبل النشر الرسمي.";

  const markdown = [
    `# شروط الاستخدام — ${APP_NAME}`,
    "",
    disclaimer,
    "",
    ...sections.flatMap((s) => [`## ${s.title}`, "", s.body, ""]),
  ].join("\n");

  return { sections, markdown, generatedAt: new Date().toISOString() };
}
