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
import { SUPPORT_URL, COOKIES_URL, DATA_EXPORT_URL } from "@/lib/release/metadata-config";

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
      body: `يستخدم تطبيق ${APP_NAME} خدمات المصادقة والتخزين السحابي المرتبطة بـ Lovable Cloud وSupabase لإدارة جلسة حسابك. تسجيل الدخول المتاح في الواجهة الحالية هو Google OAuth. تُحفظ جلسة الدخول في تخزين الجهاز/المتصفح، ويُستخدم مزود الهوية والخدمة السحابية لإتمام المصادقة وتشغيل التطبيق؛ لذلك قد تُعالَج بيانات أساسية لدى هذه الجهات.`,
    },
    {
      id: "data_storage",
      title: "أين تُخزَّن بياناتك",
      body: `تُحفظ المحافظ والعمليات والمصاريف والديون والاستثمارات وسجلات الزكاة في قاعدة بيانات Supabase، مع ضوابط الوصول المرتبطة بالمستخدم (RLS). تُحفظ المرفقات في Storage. تختلف منطقة استضافة البيانات والسياسات التشغيلية بحسب إعدادات المشروع ويجب الإفصاح عنها والتحقق منها قبل إطلاق الخدمة للجمهور.`,
    },
    {
      id: "local_storage",
      title: "البيانات المخزَّنة محلياً على جهازك",
      body: `بعض التفضيلات وسجلات التشغيل تُخزَّن محلياً في متصفحك/جهازك فقط (localStorage) ولا تُرسَل لأي خادم: تفضيلات الإشعارات وسجلها، تفضيلات الإعلانات، تفضيلات التذكيرات، اختيار الإجراءات السريعة، ملاحظات الاختبار التجريبي (Beta Feedback)، وإحصاءات جلسات الاستخدام المحلية. يمكنك مسح هذه البيانات في أي وقت من إعدادات المتصفح أو عند إلغاء تثبيت التطبيق. تفاصيل كاملة في سياسة ملفات تعريف الارتباط والتخزين المحلي: ${COOKIES_URL}.`,
    },
    {
      id: "notifications",
      title: "الإشعارات",
      body: `تُرسَل الإشعارات محلياً فقط عبر واجهة المتصفح (Web Notifications API) أو إشعارات الجهاز المحلية عند التشغيل كتطبيق أصلي — لا يوجد خادم دفع مركزي (Push Server)، ولا تُرسَل بيانات إشعاراتك لأي طرف ثالث.`,
    },
    {
      id: "ads",
      title: "الإعلانات",
      body: `لا تُشغَّل حالياً شبكة إعلانات فعلية داخل رصد، رغم وجود إعدادات وواجهات تمهيدية للإعلانات. إذا فُعّلت الإعلانات لاحقاً، فستحتاج سياسة الخصوصية والموافقات إلى تحديث يوضح مزودي الإعلان ومعالجة البيانات قبل التفعيل.`,
    },
    {
      id: "backup",
      title: "النسخ الاحتياطي والتصدير",
      body: `يوفر رصد تصدير البيانات المالية بصيغ محلية، وبعض الصيغ القديمة غير مشفرة ويجب حمايتها. يوجد خيار تنزيل نسخة v2 مشفرة بكلمة مرور على الجهاز، وخيار اختياري لحفظ نسخة مشفرة في مساحة Supabase Storage خاصة بالحساب، بشرط تفعيل التخزين السحابي في المشروع. التشفير يتم على جهاز المستخدم قبل الرفع، ولا تُرفع كلمة مرور النسخة. استعادة النسخ قد تستبدل البيانات الحالية بعد تأكيد صريح ونقطة رجوع مشفرة. لا تشمل النسخ المالية الحالية الملفات المرفقة، ولا تستخدم Google Drive، ولا توجد جدولة نسخ تلقائية. احتفظ بنسخة إضافية على جهاز منفصل.`,
    },
    {
      id: "analytics",
      title: "التحليلات والرؤى",
      body: `محرك "الرؤى المالية" في التطبيق يحسب كل مؤشراته محلياً من بياناتك المخزَّنة في حسابك على Supabase فقط — لا يُستخدَم أي SDK تحليلات أو تتبّع خارجي (مثل Google Analytics أو Firebase Analytics)، ولا تُرسَل بيانات استخدامك لأي طرف ثالث لأغراض تسويقية أو تحليلية.`,
    },
    {
      id: "your_rights",
      title: "حقوقك",
      body: `يمكنك طلب تصدير البيانات المالية من الإعدادات أو مراجعة صفحة تصدير البيانات: ${DATA_EXPORT_URL}. قد لا تشمل ملفات التصدير الحالية المرفقات وبعض السجلات التشغيلية؛ لذلك لا تُعدّ بمفردها نسخة كاملة لكل البيانات. لحذف الحساب وبياناته المرتبطة به، استخدم «حذف الحساب» من الإعدادات أو تواصل معنا عبر ${SUPPORT_URL}.`,
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
