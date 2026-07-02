# خطة التطوير — الحالة والمتابعة

هذا الملف يتتبّع خطة التطوير الفعلية لمشروع **رصد** (`balance-buddy-980`) مقابل الكود الموجود
فعلياً، حتى تلتقط أي جلسة Claude Code لاحقة العمل من حيث توقف، دون إعادة اكتشاف ما تم إنجازه.
حدّث هذا الملف كلما اكتمل بند أو استُجد بند جديد.

آخر مراجعة: 2026-07-02 (فرع `claude/project-setup-plan-4fz4w9`) — أُضيف القسم 5 (Notification
Delivery Engine) في نفس اليوم.

---

## 1. الخطة الأصلية: توحيد الأصول والاستثمارات (`.lovable/plan.md`)

الخطة الموثّقة في `.lovable/plan.md` (دمج `investments` في كيان **Asset** موحّد بمحرك حركات
CapEx/OpEx/Income/Adjustment) **منفَّذة بالكامل فعلياً**، وتجاوزها الكود في عدة نقاط:

| بند الخطة | الحالة | الموقع في الكود |
|---|---|---|
| 1.1 توسيع `investments` (asset_kind, base_value, current_value, status...) | ✅ منجز | `supabase/migrations/2026062304*.sql` |
| 1.2 توسيع `investment_transactions` بـ `tx_class` | ✅ منجز | نفس الهجرات، `investment_transactions.tx_class` |
| 1.3 مزامنة OpEx إلى المصاريف | ✅ منجز | `app.expenses.tsx` (فلتر `tx_class = 'opex'`) |
| 2. `computeAssetMetrics` | ✅ منجز | `src/lib/assets/calculator.ts` |
| 3.1 نموذج أصل موحّد (النوع/الغرض/المحفظة) | ✅ منجز | `app.investments.tsx` (Dialog الإضافة) |
| 3.2 لوحة تحكم الأصل | ✅ منجز — **بشكل أوسع من الخطة**: بدل مسار `$id` منفصل، تم تنفيذها كـ Dialog بـ 9 تبويبات (نظرة عامة، المكونات، الحركات، ملخص مالي، الأداء، القيمة السوقية، الإهلاك، الزكاة، ملاحظات ومرفقات) | `app.investments.tsx:302-...` |
| 3.3 `AssetTxForm` بحقل `tx_class` | ✅ منجز (ضمن نموذج الحركة في `app.investments.tsx`) | |
| 3.4 شارة "من أصل" وفلتر في المصاريف | ✅ منجز | `app.expenses.tsx` |
| 3.5 قسم "أداء الأصول" في التقارير | ✅ منجز | `app.reports.tsx` (`type === "assets"`) |
| 4. تحديث `classifyAsset` (asset_kind + purpose + current_value) | ✅ منجز | `src/lib/zakat/engine.ts` + `src/lib/assets/zakat-asset.ts` |
| 5. عدم كسر المحافظ/الديون/RLS/الزكاة الذكية | ✅ محافَظ عليه | |

**خلاصة:** لا يوجد عمل متبقٍّ من هذه الخطة تحديداً. هذا الملف (`.lovable/plan.md`) أصبح تأريخياً
ولم يعد يعكس نطاق العمل الحالي — الكود تجاوزه بمراحل (زكاة الأصول، الإهلاك، سجل القيمة السوقية،
الأحداث، النسخ الاحتياطي — انظر القسم التالي).

---

## 2. ميزات منجزة بعد/بجانب الخطة الأصلية (بحسب سجل Git)

- ✅ تبويب "زكاة الأصول" (`AssetZakatTab.tsx`, `src/lib/assets/zakat-asset.ts`) — حساب زكاة لكل
  أصل بطريقة (قيمة سوقية/دفترية/مخصّصة) ونطاق (الأصل/المكونات/كلاهما).
- ✅ الإهلاك (`DepreciationTab.tsx`, `src/lib/assets/depreciation.ts`).
- ✅ سجل القيمة السوقية (`MarketValueHistoryTab.tsx`, جدول `asset_market_values`).
- ✅ مكوّنات الأصل (`AssetComponentsTab.tsx`).
- ✅ أداء الاستثمار (`InvestmentPerformanceTab.tsx`, `src/lib/assets/performance.ts`).
- ✅ نظام الأحداث والتذكيرات (`app.events.tsx`, `src/lib/events/engine.ts`,
  `dashboard/UpcomingEventsWidget.tsx`, `ReminderSettingsSection.tsx`, جدول `system_events`).
- ✅ محرك النسخ الاحتياطي والاستعادة (`src/lib/backup/engine.ts`, `BackupRestoreSection.tsx`).
- ✅ استيراد جهات الاتصال (`ContactImportButton.tsx`, `ContactPicker.tsx`).
- ✅ كشف حساب لكل شخص (`PersonStatementDrawer.tsx`, `StatementTable.tsx`, `export-statement.ts`
  — تصدير PDF/Excel).
- ✅ تغليف Capacitor لأندرويد جاهز بالكامل (`MOBILE_BUILD.md`, `capacitor.config.ts`,
  `resources/`).
- ✅ `CLAUDE.md` (هذه الجلسة) — توثيق البنية المعمارية للمشروع لأي جلسة Claude Code لاحقة.

---

## 3. فجوات ونقاط مفتوحة حقيقية (موجودة في الكود، غير مفتَعلة)

بالبحث عن TODO/"قريباً" في الكود:

- ⏳ **إعلانات (AdSense/AdMob)**: `src/lib/ads/ad-config.ts` يحتوي معرّفات وهمية بالكامل
  (`ca-pub-XXXXXXXXXXXXXXXX`, `ca-app-pub-XXX/...`) بعلامة `// TODO`. يحتاج استبدالها بمعرّفات
  حقيقية قبل الإطلاق الفعلي لو كان الاعتماد على الإعلانات مطلوباً.
- ⏳ **مزامنة سحابية** لملفات النسخ الاحتياطي: شارة "قريباً" في `BackupRestoreSection.tsx`
  (التصدير/الاستيراد اليدوي يعمل، لكن لا مزامنة تلقائية حالياً).
- ⚠️ **قسم "إعدادات متقدمة" في `app.settings.tsx`**: كان يعرض قائمة "قيد التحضير" تتضمّن عناصر
  (إعدادات الزكاة، إعدادات الإهلاك، أسعار الصرف، النسخ الاحتياطي) موجودة فعلياً ومُفعّلة في أماكن
  أخرى من التطبيق. عنصر "الإشعارات" أُزيل من هذه القائمة عند تنفيذ محرك الإشعارات (القسم 5) لأنه
  لم يعد صحيحاً. باقي العناصر لا تزال بحاجة مراجعة لحذفها أو ربطها بمكانها الفعلي.
- ⏳ **لا يوجد اختبارات آلية** في المشروع (لا سكربت test، لا vitest/jest). أي تغيير مستقبلي حساس
  (حسابات الزكاة، `computeAssetMetrics`، رصيد المحفظة) يعتمد فقط على الاختبار اليدوي.

---

## 5. Prompt 15 — Notification Delivery Engine (منجز)

طبقة إرسال إشعارات فوق `system_events` (قراءة فقط، عبر `computeUpcomingEvents` الموجود في
`src/lib/events/engine.ts`) — دون أي تعديل على `transactions`/`investment_transactions`/
`investments`/`person_ledger`/`system_events`/Triggers، ودون إنشاء أي Route جديد أو أي Event جديد.

| الملف | الدور |
|---|---|
| `src/lib/notifications/config.ts` | `NotificationSettings` (تفعيل، قنوات، ساعات هدوء، أدنى أولوية) — محفوظة في localStorage فقط، بنفس نمط `ReminderPrefs`/`AdPrefs`. |
| `src/lib/notifications/provider.ts` | واجهة `NotificationProvider` (sendPush/sendEmail/sendSms/sendWhatsApp/scheduleLocal) + `NoopNotificationProvider` أساسية + 4 Stubs (Push/Email/SMS/WhatsApp) + `LocalNotificationProvider` حقيقي (Web Notifications API، وفرع Capacitor عبر `Capacitor.Plugins.LocalNotifications` بدون استيراد ثابت للحزمة). |
| `src/lib/notifications/store.ts` | سجل الإشعارات (localStorage) — dedupe بالحدث+القناة، تعليم مقروء/أرشفة/حذف. |
| `src/lib/notifications/engine.ts` | `processPendingNotifications()` — يقرأ الأحداث المستحقة، يطبّق فلتر الأولوية وساعات الهدوء، يستدعي المزوّد المناسب، يسجّل النتيجة. |
| `src/components/NotificationSettingsSection.tsx` | تبويب "الإشعارات" الجديد داخل `app.settings.tsx` (تفعيل، قنوات، ساعات هدوء، أدنى أولوية، زر "فحص الآن"). |
| `src/components/NotificationCenter.tsx` | مركز الإشعارات (غير مقروء/اليوم/هذا الأسبوع/الكل + تعليم كمقروء/أرشفة/حذف) — أُضيف كتبويب داخل صفحة `/app/events` الموجودة (بدون Route جديد). |
| `src/routes/_authenticated/route.tsx` | Tick طوعي في الواجهة (mount + كل 5 دقائق طالما التطبيق مفتوح) يستدعي `processPendingNotifications()` — لا Cron ولا Background Worker. |

**تقرير الإغلاق:**
- **جداول جديدة؟** لا. كل شيء (الإعدادات + سجل الإشعارات) في localStorage — Schema Freeze v1.0 محفوظ بالكامل، صفر هجرات SQL.
- **يدعم Android/iOS؟** القناة المحلية تعمل فعلياً عبر متصفح الويب (وWebView إن سمح). الفرع الأصلي لإشعارات Capacitor مكتوب ومربوط بالكامل، لكنه معطّل حالياً لأن تثبيت حزمة `@capacitor/local-notifications` كان محظوراً في بيئة التطوير هذه (سجل npm الخاص برفض الطلبات بـ403 لعدد كبير من الحزم — قيد بيئة الحاويّة، وليس قراراً تصميمياً). لتفعيله لاحقاً: `bun add @capacitor/local-notifications`، ثم استيراد الحزمة مرة واحدة (سطر Side-effect، مثلاً في `src/router.tsx` أو نقطة دخول التطبيق) لتسجيل الـ Plugin على `window.Capacitor.Plugins` — لا حاجة لتعديل أي كود في `src/lib/notifications/`.
- **يمكن إضافة FCM لاحقاً؟** نعم — فقط استبدال جسم `PushProviderStub.sendPush` بنداء حقيقي؛ لا شيء آخر في المحرك أو الواجهات يحتاج تعديلاً.
- **يمكن إضافة Email/SMS/WhatsApp لاحقاً؟** نعم، بنفس الطريقة (استبدال جسم كل Stub الموافق).
- **Schema Freeze v1.0 محفوظ؟** نعم بالكامل — صفر تعديل على أي جدول أو Trigger أو Route موجود، وصفر Event جديد يُكتب في `system_events`.
- **تغيّر أي سلوك موجود؟** التغيير الوحيد خارج الملفات الجديدة: إزالة عنصر "الإشعارات" من قائمة "قيد التحضير" في `app.settings.tsx` (لم يعد صحيحاً)، وتحديث نص توضيحي واحد في `ReminderSettingsSection.tsx` ليشير إلى التبويب الجديد. لا تغيير في حسابات الزكاة/الأصول/المحافظ.

---

## 6. كيف تُحدَّث هذه الوثيقة

- عند إنجاز بند من "الفجوات" أعلاه: انقله إلى قسم "منجزة" مع رابط الملف/الالتزام (commit).
- عند بدء خطة تطوير جديدة (سواء مطروحة من المستخدم أو من `.lovable/plan.md` مستقبلاً): أضف قسماً
  جديداً بنفس نمط الجدول في القسم 1 (بند / حالة / موقع في الكود).
- لا تُبقِ بنوداً "قيد التنفيذ" بلا تاريخ أو سياق — إما أنجزها، أو وثّق سبب التوقف بوضوح.
