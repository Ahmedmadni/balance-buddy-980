// =============================================================
// PART 1 — generatePrivacyPolicy()
// -------------------------------------------------------------
// Generates real policy TEXT (not an audit) grounded in this app's
// actual architecture: Supabase Auth, RLS-scoped storage, local-only
// preference/log storage, local-only notifications, ad architecture
// (AdSense/AdMob placeholders — no real SDK loaded), manual local
// backup, and a fully local analytics engine (no third-party SDK).
// This is a draft to review with a lawyer before publishing, not legal
// advice — the generator says so explicitly in its output.
// =============================================================
import { APP_VERSION } from "@/lib/mobile/version";
import { SUPPORT_URL } from "@/lib/release/metadata-config";

const APP_NAME = "رصد";

export interface PrivacyPolicySection {
  id: string;
  title: string;
  body: string;
}

export interface GeneratedPrivacyPolicy {
  sections: PrivacyPolicySection[];
  markdown: string;
  generatedAt: string;
}

export function generatePrivacyPolicy(): GeneratedPrivacyPolicy {
  const sections: PrivacyPolicySection[] = [
    {
      id: "auth",
      title: "الحساب والمصادقة",
      body: `يستخدم تطبيق ${APP_NAME} خدمة Supabase Auth لإدارة حسابك (البريد الإلكتروني وكلمة المرور أو مزوّد OAuth). تُخزَّن جلسة الدخول محلياً في متصفحك/جهازك (localStorage) ويُجدَّد رمز الدخول تلقائياً. لا تُشارَك بيانات المصادقة مع أي طرف ثالث خارج Supabase (مزوّد البنية التحتية للتطبيق).`,
    },
    {
      id: "data_storage",
      title: "أين تُخزَّن بياناتك",
      body: `بياناتك المالية (المحافظ، العمليات، المصاريف، الديون، الأصول والاستثمارات، سجلات الزكاة) تُخزَّن في قاعدة بيانات Supabase Cloud، مقيَّدة بسياسات Row Level Security (RLS) تربط كل صف بحسابك فقط — لا يمكن لأي مستخدم آخر الوصول إليها. مرفقاتك (الإيصالات والملفات) تُخزَّن في Supabase Storage بنفس القيود.`,
    },
    {
      id: "local_storage",
      title: "البيانات المخزَّنة محلياً على جهازك",
      body: `بعض التفضيلات وسجلات التشغيل تُخزَّن محلياً في متصفحك/جهازك فقط (localStorage) ولا تُرسَل لأي خادم: تفضيلات الإشعارات وسجلها، تفضيلات الإعلانات، تفضيلات التذكيرات، اختيار الإجراءات السريعة، ملاحظات الاختبار التجريبي (Beta Feedback)، وإحصاءات جلسات الاستخدام المحلية. يمكنك مسح هذه البيانات في أي وقت من إعدادات المتصفح أو عند إلغاء تثبيت التطبيق.`,
    },
    {
      id: "notifications",
      title: "الإشعارات",
      body: `تُرسَل الإشعارات محلياً فقط عبر واجهة المتصفح (Web Notifications API) أو إشعارات الجهاز المحلية عند التشغيل كتطبيق أصلي — لا يوجد خادم دفع مركزي (Push Server)، ولا تُرسَل بيانات إشعاراتك لأي طرف ثالث.`,
    },
    {
      id: "ads",
      title: "الإعلانات",
      body: `قد يعرض التطبيق إعلانات عبر Google AdSense (الويب) أو Google AdMob (الجوال) في نسخته غير المدفوعة. عند تفعيل الإعلانات، قد يستخدم Google معرّفات إعلانية لعرض إعلانات مخصّصة وفق سياسة خصوصية Google الخاصة بها. يمكنك تعطيل الإعلانات نهائياً عبر تفعيل وضع Premium من الإعدادات.`,
    },
    {
      id: "backup",
      title: "النسخ الاحتياطي والتصدير",
      body: `يمكنك تصدير نسخة من بياناتك بصيغة JSON أو Excel أو CSV في أي وقت من الإعدادات. النسخ الاحتياطي محلي بالكامل — يُحفَظ الملف على جهازك، ولا يُرفَع تلقائياً لأي خدمة تخزين سحابي خارجية.`,
    },
    {
      id: "analytics",
      title: "التحليلات والرؤى",
      body: `محرك "الرؤى المالية" في التطبيق يحسب كل مؤشراته محلياً من بياناتك المخزَّنة في حسابك على Supabase فقط — لا يُستخدَم أي SDK تحليلات أو تتبّع خارجي (مثل Google Analytics أو Firebase Analytics)، ولا تُرسَل بيانات استخدامك لأي طرف ثالث لأغراض تسويقية أو تحليلية.`,
    },
    {
      id: "your_rights",
      title: "حقوقك",
      body: `يمكنك في أي وقت تصدير كامل بياناتك من الإعدادات. لطلب حذف حسابك وبياناته بالكامل، تواصل معنا عبر ${SUPPORT_URL}.`,
    },
    {
      id: "contact",
      title: "التواصل",
      body: `لأي استفسار متعلق بالخصوصية، راسلنا عبر ${SUPPORT_URL}. الإصدار الحالي من التطبيق: ${APP_VERSION}.`,
    },
  ];

  const disclaimer =
    "> **مسودة تلقائية** — هذا النص مُولَّد من البنية التقنية الفعلية للتطبيق وقت الإنشاء، وليس استشارة قانونية. راجعها مع مختص قانوني قبل النشر الرسمي.";

  const markdown = [
    `# سياسة الخصوصية — ${APP_NAME}`,
    "",
    disclaimer,
    "",
    ...sections.flatMap((s) => [`## ${s.title}`, "", s.body, ""]),
  ].join("\n");

  return { sections, markdown, generatedAt: new Date().toISOString() };
}
