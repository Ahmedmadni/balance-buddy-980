# خطة التطوير — الحالة والمتابعة

هذا الملف يتتبّع خطة التطوير الفعلية لمشروع **رصد** (`balance-buddy-980`) مقابل الكود الموجود
فعلياً، حتى تلتقط أي جلسة Claude Code لاحقة العمل من حيث توقف، دون إعادة اكتشاف ما تم إنجازه.
حدّث هذا الملف كلما اكتمل بند أو استُجد بند جديد.

آخر مراجعة: 2026-07-03 (فرع `claude/project-setup-plan-4fz4w9`) — أُضيف القسم 5 (Notification
Delivery Engine)، القسم 7 (Analytics & Insights Engine)، القسم 9 (Production Hardening)، القسم 11
(Mobile Packaging & Cross-Platform Readiness)، القسم 13 (Ads Production Readiness)، والقسم 15
(UX Polish & Beta Testing Readiness).

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

## 7. Prompt 16 — Analytics & Insights Engine (منجز)

طبقة قراءة-فقط `computeFinancialInsights()` فوق كل المحركات الحالية (wallets, transactions,
expenses, person_ledger, investments, investment_transactions, asset_market_values,
depreciation_profiles, zakat_records, system_events) — بدون أي جدول جديد، بدون تعديل أي منطق مالي،
بدون تغيير أي Route موجود.

| الملف | الدور |
|---|---|
| `src/lib/insights/types.ts` | كل الأنواع (`FinancialInsights` وكل قسم فرعي) — قيم مالية كـ `CurrencyMap` (نفس اصطلاح لوحة التحكم/التقارير، بلا تحويل عملات). |
| `src/lib/insights/calculator.ts` | دوال حساب نقية (Wealth/CashFlow/Investment/Asset/Debt) تُعاد استخدام `computeWalletBalance` و`computeAssetMetrics`/`computeDepreciation` الموجودة بدل إعادة حسابها بمنطق مختلف. |
| `src/lib/insights/engine.ts` | `computeFinancialInsights()` — يجلب كل الجداول المذكورة بالتوازي، يستدعي الحاسبات النقية، ويدمج `computeUpcomingEvents()` الموجود لتحليل التذكيرات وآخر سجل `zakat_records` + `nextZakatDate()` لتحليل الزكاة. |
| `src/routes/_authenticated/app.insights.tsx` | صفحة **الرؤى المالية** الجديدة (`/app/insights`) — بطاقات KPI، رسم بياني للتدفق النقدي آخر 6 أشهر، Top Lists لكل قسم. |
| `src/components/dashboard/WealthOverviewWidgets.tsx` | 4 ودجات جديدة في لوحة التحكم: صافي الثروة، صافي التدفق النقدي، أداء الاستثمارات (متوسط ROI)، حالة الزكاة. Upcoming Events كانت موجودة مسبقاً (`UpcomingEventsWidget`). |
| `src/routes/_authenticated/route.tsx` | إضافة بند تنقّل واحد "الرؤى المالية" في نهاية `NAV` (لم تُغيَّر أي فهارس تنقّل موجودة تُستخدم في `BOTTOM_NAV`). |
| `src/routes/_authenticated/app.index.tsx` | إدراج `WealthOverviewWidgets` في لوحة التحكم — بدون حذف أي بطاقة موجودة. |

**تقرير الإغلاق:**
- **جداول جديدة؟** لا. `computeFinancialInsights()` قراءة فقط من الجداول المذكورة في الطلب، صفر هجرات SQL.
- **Schema Freeze محفوظ؟** نعم بالكامل — صفر تعديل على `transactions`/`investments`/`investment_transactions`/`person_ledger`/`system_events`/Triggers، وصفر Route موجود تغيّر (تمت إضافة Route واحد جديد: `/app/insights`، وهو مطلوب صراحة في الطلب: "إنشاء صفحة: Financial Insights").
- **يمكن إضافة AI Insights لاحقاً؟** نعم — طبقة العرض (`app.insights.tsx`) والحاسبات (`calculator.ts`) منفصلتان عن الجلب (`engine.ts`)؛ أي تحليل ذكي مستقبلي يُبنى كطبقة جديدة تستهلك `FinancialInsights` الحالي دون تعديله.
- **يمكن إضافة Forecasting لاحقاً؟** نعم، لكن لم يُنفَّذ أي تنبؤ هنا — `calcCashFlowTrend()` يعرض فقط أشهراً ماضية فعلية (Trend تاريخي)، ولا يُسقط أي قيمة مستقبلية.
- **تغيّر أي سلوك موجود؟** لا شيء في المنطق المالي. التغييرات الوحيدة خارج الملفات الجديدة: سطر واحد في `NAV` (route.tsx)، وإدراج ودجة واحدة إضافية في `app.index.tsx` (لا حذف لأي بطاقة/قسم موجود).

**ملاحظة بيئية:** `routeTree.gen.ts` (مولَّد تلقائياً بواسطة إضافة TanStack Router عند تشغيل
`bun run dev`/`build`) لم يتضمن بعد مسار `/app/insights` وقت الفحص، لأن هذه البيئة السحابية لا
تشغّل خادم Vite (نفس قيد تثبيت الحزم المذكور في تقرير Prompt 15). هذا الملف يُعاد توليده تلقائياً
عند أول تشغيل حقيقي للمشروع (Lovable أو محلياً) — لا حاجة لأي تدخّل يدوي، والمشروع يمنع صراحة
تعديل هذا الملف يدوياً.

---

## 9. Prompt 17 — Production Hardening & Operational Readiness (منجز)

طبقة جاهزية إنتاج فوق كل المحركات الحالية: تدقيق (Audit)، تتبّع أخطاء (Error Tracking)، فحص صحي
(Health Check)، تحقّق سلامة مالية (Integrity Validator)، مقاييس أداء (Performance)، أدوات استعادة
(Recovery Tools)، ولوحة تشخيص Beta (`/app/system`). كل شيء قراءة فقط أو تخزين محلي — بدون أي تعديل
على `transactions`/`investment_transactions`/`investments`/`person_ledger`/`system_events`/
`v_account_statement`/أي Trigger/أي RLS Policy موجودة، وبدون تغيير منطق الزكاة أو الإهلاك أو محرك
الاستثمار.

| الملف | الدور |
|---|---|
| `src/lib/system/audit.ts` | `createAuditEntry()` — سجل محلي (localStorage) لأحداث منخفضة التكرار فقط (دخول/خروج/استيراد/تصدير/نسخ احتياطي/استعادة/حذف/أرشفة/تغييرات إعدادات رئيسية). لا يسجّل `transactions` ولا `investment_transactions` ولا أي عملية يومية متكررة. |
| `src/lib/system/errors.ts` | `captureApplicationError()` + `initErrorTracking()` — سجل أخطاء محلي منفصل عن `error-capture.ts`/`lovable-error-reporting.ts` الموجودين (لم يُعدَّلا)، مع مستمعّي `window.error`/`unhandledrejection` سلبيين (بلا Cron ولا Worker). |
| `src/lib/system/shared.ts` | `reconcileWallets()` و`checkTransactionSync()` — يعيدان اشتقاق الأرقام عبر `computeWalletBalance()` الموجودة ويقارنانها بـ`v_account_statement`/`transactions` (قراءة فقط). |
| `src/lib/system/health.ts` | `runSystemHealthCheck()` — 4 أقسام: قاعدة البيانات (وجود الجداول)، محرك العمليات المالية (تطابق + مزامنة)، الأصول (مكونات يتيمة/تقييمات مفقودة/إهلاك ناقص)، الأحداث (منتهية/مكررة). |
| `src/lib/system/integrity.ts` | `validateFinancialIntegrity()` → `{valid, warnings, errors}` — يعيد استخدام `computeWalletBalance`/`computeAssetMetrics`/`computeAssetZakat` الموجودة، لا يحسب بمنطق مختلف. |
| `src/lib/system/performance.ts` | `collectPerformanceMetrics()` — مدد استعلامات فعلية، مساحة localStorage، تقدير IndexedDB (`navigator.storage.estimate()`)، حجم آخر نسخة احتياطية (عبر `loadLastBackup()` الموجودة)، عدد إشعارات، عدد أحداث (`computeUpcomingEvents()`). |
| `src/lib/system/recovery.ts` | أدوات Verify Database / Rebuild Cache / Recompute Insights / Recompute Events / Validate Assets / Validate Investments (يعيد استخدام `computeInvestmentPerformance()`) / Export Diagnostic Report. |
| `src/components/SystemToolsSection.tsx` | تبويب "النظام" الجديد داخل `app.settings.tsx` — أزرار أدوات الاستعادة السبعة. |
| `src/routes/_authenticated/app.system.tsx` | صفحة **تشخيص النظام** الجديدة (`/app/system`) — Health/Performance/Integrity + توصيات، بدون إضافتها لقائمة التنقّل الرئيسية (يصلها المستخدم عبر تبويب النظام في الإعدادات فقط، لأنها أداة تقنية وليست ميزة للمستخدم النهائي). |
| `__root.tsx` | ربط `createAuditEntry("login"/"logout")` بحدث `onAuthStateChange` الموجود أصلاً (نقطة واحدة، ليست عالية التكرار)، و`initErrorTracking()` عند تحميل التطبيق. |
| `BackupRestoreSection.tsx`, `ContactImportButton.tsx`, `notifications/engine.ts` | نقاط تدقيق/أخطاء إضافية: تصدير/استيراد نسخة احتياطية، استيراد جهات اتصال، فشل إرسال إشعار. |

**تصحيح منطقي أثناء البناء:** اكتُشف أن `v_account_statement` يُغذّى فعلياً من `wallet_transactions`
فقط — محفّزات المزامنة الخاصة بـ`expenses`/`person_ledger` تضبط `affects_balance = (wallet_id IS
NULL)`، أي أنها **تُستبعد دائماً** من هذا العرض عندما تكون مرتبطة بمحفظة حقيقية. مقارنة رصيد المحفظة
الكامل (`computeWalletBalance`, يشمل المصاريف) بهذا العرض كانت ستُنتج نتيجة "عدم تطابق" خاطئة لكل
محفظة تقريباً. تم تصحيح `reconcileWallets()` لمقارنة حركات المحفظة فقط (`wallet_transactions`) مقابل
العرض — وهو ما يعكسه العرض فعلياً — مع الإبقاء على الرصيد الكامل للعرض في الواجهة فقط دون استخدامه
في قرار التطابق.

**تقرير الإغلاق (وفق الأسئلة العشرة المطلوبة) — أيضاً معروض في نهاية الرد على المستخدم:**
انظر ملخص الإغلاق الكامل في رسالة الجلسة؛ خلاصته: صفر جداول جديدة، صفر migrations، Schema Freeze
محفوظ بالكامل، إعادة استخدام كل المحركات المطلوبة (`computeWalletBalance`, `computeAssetMetrics`,
`computeDepreciation`, `computeInvestmentPerformance`, `computeAssetZakat`, `computeUpcomingEvents`,
`computeFinancialInsights`)، الأداء إضافي خفيف (استعلامات قراءة فقط عند فتح صفحة النظام أو الضغط على
أداة، لا شيء يعمل في الخلفية)، ولا تغيير في أي سلوك مالي قائم.

---

## 11. Prompt 18 — Mobile Packaging & Cross-Platform Readiness (منجز)

طبقة Mobile Runtime مستقلة فوق النظام الحالي: كشف منصة، تدقيق توافق، طبقة خدمات جهاز (تخزين/
إشعارات/مشاركة/ملفات)، جاهزية عدم الاتصال، جاهزية AdMob (تحقق إعدادات فقط)، وقائمة تحقق إطلاق. صفر
جداول جديدة، صفر migrations، صفر تعديل على أي منطق مالي/زكاة/إهلاك/استثمار/Analytics/Notifications
Engine/Backup Engine.

| الملف | الدور |
|---|---|
| `src/lib/mobile/platform.ts` | `isAndroid/isIOS/isNative/isWeb/getPlatform()` — يقرأ `window.Capacitor` وقت التشغيل (بلا استيراد ثابت)، ويستخدم `detectPlatform()` الموجودة في `ad-provider.ts` كبديل عند التشغيل على الويب بدل تكرار منطق فحص User-Agent. |
| `src/lib/mobile/compatibility.ts` | `auditMobileCompatibility()` (localStorage, IndexedDB, تصدير/استيراد ملفات، إشعارات، كاميرا، صلاحية تخزين، Deep Links، Share API) و`checkOfflineCapabilities()` — يعيد استخدام `collectPerformanceMetrics()`, `loadNotificationLog()`, `loadLastBackup()` بدل قياسها من جديد. |
| `src/lib/mobile/providers.ts` | `DeviceStorageProvider` / `DeviceNotificationProvider` / `DeviceShareProvider` / `DeviceFileProvider` — تنفيذ Web حقيقي + تنفيذ Capacitor كـ Stub (نفس نمط `NotificationProvider`). تصدير الملفات يُفوَّض مباشرة لـ `exportUserData/downloadJSON` من محرك النسخ الاحتياطي بدل إعادة كتابته. |
| `src/lib/mobile/readiness.ts` | `checkAdMobReadiness()` (يقرأ `ad-config.ts` فقط، لا يحمّل أي SDK) و`generateReleaseChecklist()` (Android/iOS/Notifications/Ads/Backup/Offline/Analytics Ready) — يعيد استخدام `computeFinancialInsights()` و`runSystemHealthCheck()`. |
| `src/lib/mobile/version.ts` | `APP_VERSION` مقروء من `package.json` (أُضيف له حقل `version` لأول مرة) بدل نص ثابت يمكن أن ينحرف عن الحقيقة. |
| `src/components/MobileSettingsSection.tsx` | تبويب "الجهاز" الجديد داخل `app.settings.tsx` — المنصة، إصدار التطبيق، مساحة التخزين، إذن الإشعارات، مجلد التصدير، تشخيص التوافق. |
| `src/routes/_authenticated/app.system.tsx` | قسم **تشخيص الجهاز (Mobile Diagnostics)** جديد داخل `/app/system` الموجودة (Device: منصة/نظام تشغيل/بيئة تشغيل/تخزين/ذاكرة، Mobile Features: إشعارات/ملفات/مشاركة/Deep Links/Offline). |
| `tsconfig.json` | إضافة `resolveJsonModule: true` فقط — لتمكين قراءة `package.json` من `version.ts`. |

**تقرير الإغلاق (الأسئلة العشرة) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations،
Schema Freeze محفوظ بالكامل، إعادة استخدام `AdProvider`/`NotificationProvider`/Backup
Engine/System Health Engine/Performance Metrics/Analytics Engine كما هي دون تعديل، متوافق مع
Android (منصّة مبنية فعلياً في المشروع) وجاهز بنيوياً لـ iOS (لا توجد منصة iOS مُضافة بعد في
Capacitor — Ads/iOS AdMob لا يزال placeholder)، ولا تغيير في أي سلوك مالي قائم.

---

## 13. Prompt 19 — Monetization & Ads Production Readiness (منجز)

تحويل بنية الإعلانات من Placeholder فقط إلى بنية جاهزة للإنتاج (بدون تحميل أي SDK حقيقي أو عرض أي
إعلان). صفر جداول جديدة، صفر migrations، صفر تعديل على أي منطق مالي.

| الملف | الدور |
|---|---|
| `src/lib/ads/placements.ts` | **مصدر الحقيقة الوحيد** لكل الأماكن الإعلانية (AdPlacement, AdFormat, AD_PLACEMENTS, PLACEMENT_FORMAT). `ad-config.ts` أصبح يعيد تصديرها بدل تعريفها محلياً (توافق كامل للخلف — لا حاجة لتعديل أي مستورد قديم). |
| `src/lib/ads/audit.ts` | `auditAdsConfiguration()` — يقارن معرّفات AdSense/AdMob (Web/Android/iOS + كل مكان إعلاني) بأنماط الـ placeholder المعروفة (`ca-app-pub-XXX...`, أرقام AdSense التسلسلية `000000000N`, معرّفات Google الاختبارية الرسمية). |
| `src/lib/ads/rules.ts` | `evaluateAdVisibility()` — استُخرجت من منطق `AdSlot.tsx` نفسه (Premium/Test Mode/Platform/User Preferences/Placement Rules) لتصبح دالة نقية قابلة لإعادة الاستخدام والاختبار؛ `AdSlot.tsx` الآن يستدعيها بدل تكرار المنطق — نفس السلوك بالضبط (تحقّق عبر جدول الحقيقة). |
| `src/lib/ads/simulation.ts` | `simulateAdRevenue()` — حساب حسابي بحت (DAU × ظهور × eCPM/CTR)، بدون أي اتصال خارجي أو بيانات مستخدمين حقيقية. |
| `src/lib/ads/premium.ts` | `validatePremiumExperience()` — يتحقق عبر `evaluateAdVisibility()` نفسها أن كل الأماكن الإعلانية (Web/Android/iOS) مخفية لمستخدم Premium، وأن `NoopAdProvider` هو الوحيد المستخدم. |
| `src/lib/mobile/readiness.ts` | `checkAdMobReadiness()` أصبح يُعيد استخدام `auditAdsConfiguration()` بدل تكرار منطق كشف الـ placeholder. أُضيفت 3 بنود جديدة لـ `generateReleaseChecklist()`: **Ads Production Ready** (كل الأماكن بمعرّفات حقيقية)، **Premium Ready** (`validatePremiumExperience()`)، **Consent Ready** (تحذير دائم بالتصميم — لا آلية Consent موجودة عمداً). |
| `src/routes/_authenticated/app.system.tsx` | قسم **حالة الإعلانات (Ads Status)** جديد داخل `/app/system` الموجودة: الحالة العامة (AdSense/AdMob/Test/Premium)، الأماكن (مفعّلة/معاينة فقط/مخفية)، ومحاكاة الإيرادات التفاعلية (تقدير فقط). |
| `src/lib/ads/ad-config.ts`, `ad-context.tsx` | تنظيف بسيط بلا تغيير سلوك: `AdPlacement`/`AdFormat`/`PLACEMENT_FORMAT` أُزيلت من هنا (أصبحت في `placements.ts`)، وأُضيفت `loadAdPrefs()` مُصدَّرة يعيد `ad-context.tsx` استخدامها بدل نسخة خاصة مكرَّرة. |

**تقرير الإغلاق (الأسئلة العشرة) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations،
Schema Freeze محفوظ بالكامل، `AdSlot`/`AdProvider`/`AdSettings`/Mobile Platform Layer/System
Diagnostics/Performance Engine جميعها أُعيد استخدامها بلا تكرار منطق، لا SDK حقيقي أو Consent أو
Tracking أُضيف، ولا تغيير في أي سلوك مالي قائم.

---

## 15. Prompt 20 — UX Polish & Beta Testing Readiness (منجز)

تهيئة التطبيق للاختبار المغلق (Closed Beta): تدقيق تجربة المستخدم/الوصول/التجاوب، تلميحات سياقية،
محرك ملاحظات محلي، قسم مساعدة في الإعدادات، ودرجة جاهزية إطلاق إجمالية. صفر جداول جديدة، صفر
migrations، صفر تعديل على أي منطق مالي/زكاة/إهلاك/استثمار/Analytics/Notifications/Backup.

| الملف | الدور |
|---|---|
| `src/lib/ux/empty-states.ts` | `auditEmptyStates()` — تدقيق **ثابت** (مُعدّ يدوياً بعد قراءة كل ملف مسار فعلياً) لجودة الحالة الفارغة في 9 صفحات أساسية (Dashboard/Wallets/Transactions/Expenses/People/Investments/Zakat/Events/Insights): هل توجد Empty State + CTA + شرح مختصر. النتيجة الفعلية: **كاملة** — Wallets، People. **جزئية** — Dashboard، Expenses، Investments، Events. **مفقودة** — Transactions، Zakat، Insights. |
| `src/lib/ux/hints.ts` | `getContextualHints()` — تلميحات سياقية **حقيقية** (استعلامات Supabase فعلية لعدد المحافظ/الأصول/سجلات الزكاة + حالة النسخ الاحتياطي والإشعارات الفعلية)، غير إلزامية، مرتبة حسب الأولوية: أضف محفظة، أضف أصل، فعّل النسخ الاحتياطي، راجع الزكاة، أكمل إعدادات الإشعارات. |
| `src/lib/ux/quick-actions.ts` | `auditQuickActions()` — تدقيق **ثابت** مبني على قراءة `QuickActionsRow.tsx` وأنماط `useSearch`/`?new=` الفعلية في كل صفحة. ضمن ضغطتين: مصروف، دخل، تحويل، دين، فتح الزكاة. **يتجاوز** الحد: إضافة أصل/استثمار (3 — الصفحة لا تقرأ `?new=`)، حدث جديد (3 — غير موجود بالتنقّل السفلي)، تصدير نسخة احتياطية (4). |
| `src/lib/ux/accessibility.ts` | `auditAccessibility()` — 5 فحوصات (Contrast، Keyboard Navigation، Screen Reader Labels، Focus States، Touch Targets)، مزيج من فحوصات DOM حية وقت التشغيل وحقيقة ثابتة واحدة موثّقة (أنماط `focus-visible:ring` في `src/components/ui`). لا حساب لنسبة تباين فعلية (يحتاج قراءة بكسلات مرسومة غير متاحة هنا). |
| `src/lib/ux/responsive.ts` | `auditResponsiveLayouts()` — حجم/اتجاه الشاشة الحالية وقت التشغيل، تأكيد وجود `viewport-fit=cover` (جاهزية Foldables/notch، موجودة فعلاً في `__root.tsx`)، وجدول ثابت لعدد ملفات كل بادئة Tailwind (`sm`/`md`/`lg`) تم التحقق منه عبر `grep`. |
| `src/lib/ux/feedback.ts` | محرك **Beta Feedback محلي بالكامل** — `submitBetaFeedback()`/`loadBetaFeedback()`/`deleteBetaFeedback()`/`clearBetaFeedback()` يخزّن في `localStorage` فقط (نفس نمط `audit.ts`/`errors.ts`)، يدعم Bug/Suggestion/Question/Rating. لا اتصال شبكي، لا جدول جديد. |
| `src/lib/ux/readiness-score.ts` | `calculateReleaseReadiness()` — يحسب **RC Score: XX/100** من 8 فئات موزونة (سلامة البيانات 20، النسخ الاحتياطي 10، الإشعارات 10، الجوال 15، الإعلانات 10، إتاحة الوصول 15، UX 10، التشخيص 10)، كل فئة تُعيد استخدام محرك فعلي موجود (Health/Integrity/Backup/Notifications/Mobile Readiness/Ads Premium Check) دون إعادة حساب أي منطق مالي. |
| `src/components/HelpSection.tsx` | قسم **Settings > المساعدة** الجديد: إصدار التطبيق (`APP_VERSION`) + معلومات البناء (منصة/أصلي أو ويب)، زر تصدير تقرير تشخيصي (يُعيد استخدام `buildDiagnosticReport`/`downloadDiagnosticReport` من Prompt 17)، رابط لفتح `/app/system`، وحوار إرسال ملاحظة (Bug/Suggestion/Question/Rating مع تقييم نجوم) يستدعي `submitBetaFeedback()`. |
| `src/routes/_authenticated/app.settings.tsx` | تبويب **المساعدة** جديد يستضيف `HelpSection` — إضافة `TabsTrigger`/`TabsContent` فقط، بلا تعديل على أي تبويب قائم. |
| `src/routes/_authenticated/app.system.tsx` | قسمان جديدان داخل لوحة التشخيص القائمة: **جاهزية الإطلاق التجريبي (Release Readiness)** يعرض `RC Score: XX/100` بشكل بارز مع تفصيل الفئات الثماني، و**تجربة المستخدم وإمكانية الوصول (UX & Accessibility)** يعرض نتائج الحالات الفارغة/الإجراءات السريعة/إتاحة الوصول/التجاوب + معاينة التلميحات السياقية النشطة حالياً. |

**تقرير الإغلاق (الأسئلة العشرة) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations،
Schema Freeze محفوظ بالكامل (لا تعديل على transactions/investment_transactions/investments/
person_ledger/system_events/v_account_statement/أي Trigger/RLS)، كل محرك مُعاد استخدامه فعلياً
(Health/Integrity/Performance/Notifications/Backup/Analytics/Mobile Readiness/Ads Audit) دون تكرار
منطقه، لا SDK تحليلات أو تتبّع مستخدمين أو استبيانات خارجية أو تخزين سحابي أُضيف، ولا تغيير في أي
سلوك مالي قائم.

---

## 16. كيف تُحدَّث هذه الوثيقة

- عند إنجاز بند من "الفجوات" أعلاه: انقله إلى قسم "منجزة" مع رابط الملف/الالتزام (commit).
- عند بدء خطة تطوير جديدة (سواء مطروحة من المستخدم أو من `.lovable/plan.md` مستقبلاً): أضف قسماً
  جديداً بنفس نمط الجدول في القسم 1 (بند / حالة / موقع في الكود).
- لا تُبقِ بنوداً "قيد التنفيذ" بلا تاريخ أو سياق — إما أنجزها، أو وثّق سبب التوقف بوضوح.
