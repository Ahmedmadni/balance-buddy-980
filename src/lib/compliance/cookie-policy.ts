// =============================================================
// PART 5 (Prompt 24) — generateCookiePolicy()
// -------------------------------------------------------------
// Same generator pattern as privacy-policy.ts/terms-of-service.ts
// (Prompt 23). Grounded in a verified fact: this app sets NO cookies at
// all — Supabase Auth's session is persisted in localStorage, not a
// cookie (see src/integrations/supabase/client.ts: `storage: ...
// localStorage`). What it does store locally is disclosed here instead.
// =============================================================
const APP_NAME = "رصد";

export interface CookiePolicySection {
  id: string;
  title: string;
  body: string;
}

export interface GeneratedCookiePolicy {
  sections: CookiePolicySection[];
  markdown: string;
  generatedAt: string;
}

export function generateCookiePolicy(): GeneratedCookiePolicy {
  const sections: CookiePolicySection[] = [
    {
      id: "no_cookies",
      title: "لا يستخدم هذا التطبيق ملفات تعريف ارتباط (Cookies)",
      body: `${APP_NAME} لا يضع أي ملف تعريف ارتباط (Cookie) على جهازك. جلسة الدخول (Supabase Auth) تُخزَّن في localStorage وليس في Cookie — لهذا لا توجد شاشة "قبول الكوكيز" التقليدية في هذا التطبيق.`,
    },
    {
      id: "local_storage_instead",
      title: "ما يُخزَّن محلياً بدلاً من ذلك",
      body: `يستخدم التطبيق localStorage وIndexedDB (تخزين المتصفح المحلي، وليس كوكيز) لحفظ: جلسة الدخول، تفضيلاتك (الإشعارات، التذكيرات، الإجراءات السريعة، الإعلانات)، سجلات محلية للتشخيص والملاحظات، ونسخة مؤقتة من آخر نسخة احتياطية. لا شيء من هذا يُرسَل تلقائياً لأي خادم إلا عند استخدامك الفعلي لميزة تعتمد عليه (مثل تسجيل الدخول).`,
    },
    {
      id: "service_worker_cache",
      title: "التخزين المؤقت (Service Worker Cache)",
      body: `قد يخزّن المتصفح نسخاً من ملفات ثابتة (الأيقونات، الخطوط، ملفات التنسيق) محلياً لتسريع فتح التطبيق ودعم العمل دون اتصال جزئياً. هذا التخزين المؤقت لا يشمل بياناتك المالية أو رمز الدخول، ويُحدَّث تلقائياً عند نشر إصدار جديد.`,
    },
    {
      id: "third_party",
      title: "أطراف ثالثة",
      body: `عند تفعيل الإعلانات مستقبلاً (Google AdSense/AdMob)، قد تضع Google كوكيز أو معرّفات خاصة بها وفق سياسة الخصوصية الخاصة بها — هذا خارج نطاق تحكّم ${APP_NAME} المباشر ويُفعَّل فقط عند إيقاف وضع Premium.`,
    },
    {
      id: "control",
      title: "التحكّم بالبيانات المحلية",
      body: `يمكنك مسح كل البيانات المحلية المذكورة أعلاه في أي وقت من إعدادات المتصفح (Clear Site Data) أو عبر إلغاء تثبيت التطبيق، دون أن يؤثر ذلك على بياناتك المحفوظة في حسابك السحابي.`,
    },
  ];

  const disclaimer =
    "> **مسودة تلقائية** — هذا النص مُولَّد من الحالة الفعلية للتطبيق وقت الإنشاء، وليس استشارة قانونية. راجعها مع مختص قانوني قبل النشر الرسمي.";

  const markdown = [
    `# سياسة ملفات تعريف الارتباط — ${APP_NAME}`,
    "",
    disclaimer,
    "",
    ...sections.flatMap((s) => [`## ${s.title}`, "", s.body, ""]),
  ].join("\n");

  return { sections, markdown, generatedAt: new Date().toISOString() };
}
