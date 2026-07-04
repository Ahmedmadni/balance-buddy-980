# خطة التطوير — الحالة والمتابعة

هذا الملف يتتبّع خطة التطوير الفعلية لمشروع **رصد** (`balance-buddy-980`) مقابل الكود الموجود
فعلياً، حتى تلتقط أي جلسة Claude Code لاحقة العمل من حيث توقف، دون إعادة اكتشاف ما تم إنجازه.
حدّث هذا الملف كلما اكتمل بند أو استُجد بند جديد.

آخر مراجعة: 2026-07-03 (فرع `claude/project-setup-plan-4fz4w9`) — أُضيف القسم 5 (Notification
Delivery Engine)، القسم 7 (Analytics & Insights Engine)، القسم 9 (Production Hardening)، القسم 11
(Mobile Packaging & Cross-Platform Readiness)، القسم 13 (Ads Production Readiness)، القسم 15
(UX Polish & Beta Testing Readiness)، القسم 17 (Closed Beta Operations Framework)، القسم 19
(Release Engineering & Store Readiness)، القسم 21 (Compliance, Privacy & Production Hardening)،
القسم 23 (Production Hardening & Compliance Remediation — Safe Mode، أول Prompt يُصلح Backup Engine
فعلياً بدل الاكتفاء بالتقرير عنه)، القسم 25 (Production Safety & Operations Layer — أعلام ميزات،
تقارير أعطال، إعدادات عن بُعد، وضع طوارئ، وبوابة إنتاج نهائية)، والقسم 27 (Account Deletion, Consent
UI, Production Legal Wiring & Launch Closure — أول شاشة موافقة حقيقية معروضة للمستخدم، وأول ربط فعلي
للصفحات القانونية داخل التطبيق).

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

## 17. Prompt 21 — Closed Beta Operations Framework (منجز)

تهيئة تشغيلية لإطلاق Beta مغلقة فعلية: قائمة تحقق للمختبر، متتبّع جلسات محلي، تدقيق تغطية ميزات،
لوحة ملاحظات تفاعلية (ترتيب/تصفية/تصدير)، اكتشاف نقاط احتكاك، درجة صحة Beta، وعوائق إطلاق. صفر
جداول جديدة، صفر migrations، صفر تعديل على أي منطق مالي.

| الملف | الدور |
|---|---|
| `src/lib/beta/session.ts` | **الأساس**: `trackBetaSession()` محرك تتبّع استخدام محلي بالكامل (`localStorage`، لا SDK تحليلات) — عدد الجلسات، مدة كل جلسة (heartbeat)، الصفحات المفتوحة ومدة كل زيارة، ووظائف/نوافذ مستخدَمة عبر `recordFeatureUse()`/`recordDialogOpened()`/`recordDialogSaved()`. جلسة جديدة تبدأ بعد 30 دقيقة خمول. مُوصَّل في `route.tsx` (تتبّع تنقّل + heartbeat + `beforeunload`) و`QuickActionsRow.tsx` (نقرات البلاطات + نافذة التخصيص) و`HelpSection.tsx` (نافذة الملاحظات). |
| `src/lib/beta/checklist.ts` | `getBetaUserChecklist()` — 8 بنود (محفظة/عملية/أصل/دين من Supabase الفعلي، نسخة احتياطية من `loadLastBackup()`، وفتح الزكاة/الرؤى/الإعدادات من الجلسات المحلية المتتبَّعة)، يحسب **Beta Completion %**. |
| `src/lib/beta/feature-coverage.ts` | `auditFeatureCoverage()` — 10 مجالات (Wallets/Expenses/Debts/Investments/Assets/Zakat/Reports/Notifications/Backup/Insights) مصنَّفة **Covered / Untested / Never Used** حسب وجود بيانات حقيقية + زيارة الصفحة محلياً. Reports/Insights بلا جدول بيانات مخصّص فمصدرهما زيارة الصفحة فقط (موثَّق في الكود). |
| `src/lib/ux/feedback.ts` | تمديد محرك Prompt 20: `sortBetaFeedback()`، `filterBetaFeedback()`، `exportBetaFeedbackAsJson()`، `downloadBetaFeedbackJson()` (نفس نمط `downloadDiagnosticReport`). |
| `src/components/BetaFeedbackDashboard.tsx` | لوحة ملاحظات Beta تفاعلية كاملة: ملخص حسب النوع + متوسط تقييم، ترتيب (الأحدث/الأقدم/التقييم)، تصفية حسب النوع، تصدير JSON، حذف فردي. |
| `src/lib/beta/friction.ts` | `detectUserFriction()` — يُعيد استخدام 3 محركات فعلية: مغادرة سريعة من إحصاءات الجلسات، صفحات بلا إجراء من `auditEmptyStates()` (quality="missing")، عمليات >ضغطتين من `auditQuickActions()`؛ زائد إشارة رابعة حقيقية جزئية (نوافذ أُغلقت دون حفظ) من نوافذ مُدرَّجة صراحةً (الملاحظات + تخصيص الإجراءات السريعة) — موثَّق كتغطية جزئية وليست شاملة. |
| `src/lib/beta/health-score.ts` | `calculateBetaHealth()` — 6 فئات موزونة (Usage 15، Completion 20، Stability 20، Feedback 15، Accessibility 15، Mobile Usage 15) تُخرج **Beta Health Score XX/100**، كل فئة تُعيد استخدام محرك فعلي (Session Tracker/Checklist/System Health/Feedback Log/Accessibility Audit). |
| `src/lib/beta/release-blockers.ts` | `detectReleaseBlockers()` — 7 فحوصات (Empty States/Mobile/Accessibility/Backup/Notifications/Ads/Help Pages) كلها تُعيد استخدام تدقيقات موجودة فعلياً، بلا تكرار منطق. |
| `src/routes/_authenticated/app.system.tsx` | قسم **عمليات الاختبار المغلق (Beta Operations)** جديد يجمع الستة: Beta Completion، Feature Coverage، Beta Health Score، Release Blockers، لوحة الملاحظات (`BetaFeedbackDashboard`)، ونقاط الاحتكاك. |

**تقرير الإغلاق (الأسئلة العشرة) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations،
Schema Freeze محفوظ بالكامل، كل محرك مُعاد استخدامه فعلياً (Help/Feedback/Release Readiness/Mobile
Readiness/Ads Audit/Notifications/System Health/Performance)، لا Firebase Analytics/PostHog/
Mixpanel/Amplitude/Hotjar/Session Replay/تخزين سحابي أُضيف — التتبّع بالكامل محلي في `localStorage`
بلا أي معرّف مستخدم يُرسَل لأي خادم، ولا تغيير في أي سلوك مالي قائم.

---

## 19. Prompt 22 — Release Engineering & Store Readiness (منجز)

تهيئة "رصد" للإطلاق الفعلي على Android وiOS والويب: تدقيق بيانات التطبيق الوصفية، تدقيق إصدار
Android/iOS، تدقيق PWA، قائمة أصول المتجر، تدقيق الامتثال والخصوصية، تدقيق بيئة الإنتاج، وقائمة
مراحل الإطلاق (5 مراحل). صفر جداول جديدة، صفر migrations، صفر تعديل على أي منطق مالي أو محرك أعمال.

| الملف | الدور |
|---|---|
| `src/lib/release/metadata-config.ts` | إعدادات مركزية **Placeholders فقط** (نفس نمط `ads/ad-config.ts`): `BUILD_NUMBER`, `PRIVACY_POLICY_URL`, `TERMS_URL`, `SUPPORT_URL`, `WEBSITE_URL` — لا رابط حقيقي واحد منها موجود فعلياً في المشروع حتى الآن (تحقّق حقيقي بالبحث). |
| `src/lib/release/metadata-audit.ts` | `auditAppMetadata()` — 8 بنود: App Name/Package Name (نسخة ثابتة موثَّقة من `capacitor.config.ts`، لم تُستورد حيّاً لتفادي اعتمادية `@capacitor/cli` غير المثبَّتة في بعض البيئات)، Version (حيّ من `package.json`)، Build Number، و4 روابط — **4 من 8 لا تزال placeholder**. |
| `src/lib/release/android-audit.ts` | `auditAndroidRelease()` — 10 فحوصات. حقيقة جوهرية موثَّقة: **لا يوجد مجلد `android/` في هذا المستودع** (`bun run android:add` لم يُشغَّل بعد)، و`allowMixedContent: true` وكائن `server` (Live Reload) لا يزالان نشطين في `capacitor.config.ts` — كلاهما يجب تعطيله قبل بناء AAB فعلي. AdMob IDs يُعاد استخدامه من `ads/audit.ts`. |
| `src/lib/release/ios-audit.ts` | `auditIOSRelease()` — 9 فحوصات. حقيقة جوهرية أكثر خطورة: **لا يوجد أي إعداد iOS إطلاقاً** — لا مجلد `ios/`، لا كائن `ios:` في `capacitor.config.ts`، ولا خطوات iOS موثَّقة في `MOBILE_BUILD.md` (Android فقط). |
| `src/lib/release/pwa-audit.ts` | `auditPWA()` — التدقيق الوحيد شبه الكامل **runtime حقيقي**: يجلب `/manifest.webmanifest` فعلياً عبر `fetch` ويحلّل حقوله، يتحقق من تسجيل Service Worker حقيقي عبر `navigator.serviceWorker.getRegistrations()`. النتيجة الحقيقية: **لا Service Worker في المشروع إطلاقاً** → `installability: false` رغم أن `manifest.webmanifest` نفسه مكتمل وصحيح. |
| `src/lib/release/store-assets.ts` | `generateStoreAssetsChecklist()` — Android (6 بنود) وiOS (5 بنود). الجاهز فعلياً: الأيقونة فقط (من `resources/icon.png`) على كلا المنصّتين؛ كل الباقي (Feature Graphic، لقطات الشاشة، الأوصاف، Metadata) غير موجود. |
| `src/lib/release/compliance-audit.ts` | `auditCompliance()` — 8 بنود. يُعيد استخدام Ads Audit (`consent_ready` من `mobile/readiness.ts`) وBackup Engine (`loadLastBackup`). حقيقة موثَّقة: **لا آلية حذف حساب/بيانات كاملة** (Data Deletion) — يوجد فقط حذف عناصر فردية، وهو ثغرة امتثال GDPR/CCPA حقيقية. |
| `src/lib/release/production-audit.ts` | `auditProductionEnvironment()` — 9 بنود. Storage وAuth فحصان **runtime حقيقيان** (استدعاء فعلي لـ `supabase.storage.from("attachments").list()` و`supabase.auth.getUser()`)؛ الباقي (Supabase/RLS/Backup/Notifications/Ads/Mobile/Analytics) يُعاد استخدامه بالكامل من محركات موجودة. |
| `src/lib/release/launch-checklist.ts` | `generateLaunchChecklist()` — 5 مراحل (Pre-Beta → Closed Beta → Open Beta → Soft Launch → Production Launch)، كل مرحلة مبنية على شروط حقيقية من `calculateReleaseReadiness()` (Prompt 20)، `calculateBetaHealth()` (Prompt 21)، `runSystemHealthCheck()`، `validateFinancialIntegrity()`، وتدقيقات هذا الـ Prompt — بلا أي إعادة حساب لمنطقها. |
| `src/routes/_authenticated/app.system.tsx` | قسم **هندسة الإطلاق وجاهزية المتاجر (Release Engineering)** جديد: شارات مراحل الإطلاق، بطاقات Android/iOS/PWA Ready، بيانات التطبيق الوصفية، تفصيل كل تدقيق، قائمة أصول المتجر، الامتثال، وبيئة الإنتاج. |

**تقرير الإغلاق (الأسئلة العشرة) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations،
Schema Freeze محفوظ بالكامل، كل محرك مُعاد استخدامه فعلياً (Mobile Readiness/Ads Audit/Release
Readiness/Beta Health/System Health/Integrity/Backup Engine) دون تكرار منطقه، لا Play Console APIs/
App Store APIs/Firebase/Crashlytics/RevenueCat/Real Ads SDK/Real Push SDK أُضيف، ولا تغيير في أي
سلوك مالي قائم. الفجوات الحقيقية المكتشفة (لا Service Worker، لا منصّة iOS، لا آلية حذف بيانات، 4
روابط قانونية/دعم لا تزال placeholder) موثَّقة بالكامل وستحتاج عملاً بشرياً فعلياً قبل أي إطلاق حقيقي.

---

## 21. Prompt 23 — Compliance, Privacy & Production Hardening (منجز)

إزالة العوائق القانونية والتشغيلية قبل الإطلاق: توليد مسودتَي سياسة خصوصية وشروط استخدام حقيقيتين
من بنية التطبيق الفعلية، تدقيق تصدير بيانات المستخدم، خطة حذف بيانات (معاينة فقط، بلا تنفيذ)،
جاهزية الموافقات، تدقيق إعدادات الإنتاج، وتدقيق التعافي من الكوارث. صفر جداول جديدة، صفر migrations،
صفر تعديل على أي منطق مالي أو محرك أعمال (بما فيها Backup/Notifications/Ads Engine نفسها).

| الملف | الدور |
|---|---|
| `src/lib/compliance/privacy-policy.ts` | `generatePrivacyPolicy()` — يُولِّد نص سياسة خصوصية حقيقي (Markdown) من 9 أقسام مبنية على حقائق معمارية فعلية: Supabase Auth، تخزين محلي (localStorage)، الإشعارات المحلية، بنية الإعلانات (Placeholders)، النسخ الاحتياطي اليدوي، والتحليلات المحلية بالكامل. يتضمّن تنويهاً صريحاً أنه مسودة تلقائية تحتاج مراجعة قانونية. |
| `src/lib/compliance/terms-of-service.ts` | `generateTermsOfService()` — 8 أقسام: الاستخدام المقبول، حدود المسؤولية، مسؤولية النسخ الاحتياطي، فقدان البيانات، الإعلانات، الاشتراكات المستقبلية (توثيق صريح أن "Premium" حالياً مجرد تفضيل محلي بلا فوترة فعلية)، إنهاء الحساب، والتعديلات. |
| `src/lib/compliance/data-export-audit.ts` | `auditUserDataExport()` — **اكتشاف حقيقي مهم** بقراءة `backup/engine.ts` مباشرة: مفتاحا `LOCAL_KEYS` المُعلَنان `"rasd.quickActions.v1"` و`"rasd.ads.v1"` لا يطابقان أي مفتاح localStorage حقيقي مكتوب فعلياً (الحقيقيان: `dashboard.quickActions.v1` في `QuickActionsRow.tsx`، و`rasd.adPrefs.v1` في `ad-config.ts`) — فتفضيلات الإجراءات السريعة والإعلانات **لا تُصدَّر فعلياً** رغم ظهورها في النسخة الاحتياطية. كما أن الإشعارات وجلسات Beta غير مشمولة إطلاقاً. |
| `src/lib/compliance/data-deletion-plan.ts` | `generateDeletionPlan()` — معاينة **قراءة فقط** (بلا أي `.delete()`/`.remove()` فعلي): سيُحذف (17 جدول Supabase + ملفات Storage + 10 مفاتيح localStorage)، سيبقى (حساب Supabase Auth نفسه — يحتاج Admin API بصلاحية service_role غير متاحة من العميل)، يحتاج تأكيداً (لا Soft Delete، تأكيد صريح مطلوب). |
| `src/lib/compliance/consent-readiness.ts` | `auditConsentReadiness()` — GDPR/CCPA/Ads Consent (يُعيد استخدام `consent_ready` من `mobile/readiness.ts`)/Analytics Consent/Tracking Consent — الأخيران "ok" فعلياً لأنه لا يوجد ما يستدعي موافقة (لا SDK تحليلات أو تتبّع خارجي). |
| `src/lib/compliance/production-config-audit.ts` | `auditProductionConfig()` — Supabase URL وEnvironment Variables فحصان **حيّان فعليان** عبر `import.meta.env` (نفس نمط `integrations/supabase/client.ts`)؛ Storage وAuth فحصان حيّان (نداء فعلي)؛ RLS/Ads/Notifications/Mobile مُعاد استخدامها بالكامل. |
| `src/lib/compliance/disaster-recovery-audit.ts` | `auditDisasterRecovery()` — Backup/Restore/Export/Recovery/Offline Recovery، تُعيد استخدام Backup Engine وSystem Recovery Tools (`verifyDatabase` من Prompt 17) وMobile Offline Capabilities مباشرة دون تكرار منطقها. |
| `src/routes/_authenticated/app.system.tsx` | قسم **الامتثال والخصوصية وجاهزية التعافي (Compliance)** جديد: بطاقتا سياسة الخصوصية/الشروط (عرض في نافذة + تنزيل .md)، جاهزية الموافقات، تدقيق تصدير البيانات، خطة الحذف (3 أعمدة: سيُحذف/سيبقى/يحتاج تأكيداً)، التعافي من الكوارث، وإعدادات الإنتاج. |

**تقرير الإغلاق (الأسئلة العشرة) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations،
Schema Freeze محفوظ بالكامل (بما في ذلك عدم لمس منطق Backup/Notifications/Ads Engine نفسها — فقط
قراءتها والتقرير عنها)، كل محرك مُعاد استخدامه فعلياً (Backup Engine/Notification Engine/Beta
Engine/System Health/Release Audit/Mobile Audit) دون تكرار منطقه، لا Legal APIs/Consent SDKs/Real
GDPR Services/Remote Deletion/Remote Analytics أُضيف، ولا تغيير في أي سلوك مالي قائم. الاكتشاف
الأهم في هذا الـ Prompt: مفتاحا نسخ احتياطي معطوبان فعلياً في محرك موجود (`quickActions`/`ads`
prefs لا تُصدَّران أبداً) — موثَّق بالكامل دون تعديل الملف المُعطوب نفسه، احتراماً لتجميد Backup Engine.

---

## 23. Prompt 24 — Production Hardening & Compliance Remediation (Safe Mode) (منجز)

على عكس Prompts 20-23، سمح هذا الـ Prompt صراحةً بتعديل Backup Engine لإصلاح الثغرات الحقيقية التي
اكتشفها Prompt 23 (بدل الاكتفاء بالتقرير عنها). أُصلح Backup Engine فعلياً، أُضيف تحقق سلامة نسخ
احتياطي، Service Worker حقيقي أول مرة، مدير موافقات محلي حقيقي، 4 صفحات قانونية منشورة فعلياً على
Routes عامة، تقرير حذف حساب مفصّل (معاينة فقط)، ومحرك تدقيق نهائي للإنتاج. صفر جداول جديدة، صفر
migrations، صفر تعديل على transactions/investment_transactions/investments/person_ledger/
system_events/v_account_statement/أي Trigger/RLS/View/محرك مالي.

| الملف | الدور |
|---|---|
| `src/lib/backup/engine.ts` (معدَّل) | **PART 1 — إصلاح فعلي**: `LOCAL_KEYS` أصبحت تضم المفاتيح الحقيقية الصحيحة (`dashboard.quickActions.v1`, `rasd.adPrefs.v1`, `rasd.notificationSettings.v1`, `rasd.notificationLog.v1`, `rasd.betaSessions.v1`, `rasd.betaFeedback.v1`) **بجانب** المفاتيح القديمة الخاطئة (لم تُحذف — توافق خلفي)؛ الاستيراد يعمل تلقائياً مع أي شكل نسخة (قديمة أو جديدة) لأنه يكرر `Object.entries(bundle.local)` عاماً بلا تغيير. نوع `BackupBundle.local` صُحِّح إلى `Record<string, unknown>` ليطابق الشكل الفعلي وقت التشغيل. |
| `src/lib/backup/integrity.ts` | **PART 2** — `verifyBackupIntegrity()`: checksum حقيقي (SHA-256 عبر SubtleCrypto مع fallback)، مطابقة عدد السجلات المعلَن بالفعلي، أقسام مفقودة/غير متطابقة، فحص إصدار المخطط، ودرجة توافق 0-100. |
| `public/sw.js` + `src/lib/pwa/register.ts` | **PART 3** — أول Service Worker حقيقي في المشروع: تخزين مؤقت Stale-While-Revalidate لأصول ثابتة نفس المصدر فقط (أيقونات/خطوط/manifest) — **يستبعد صراحة** طلبات التنقّل (HTML)، أي أصل عابر للمصدر (يشمل Supabase تلقائياً)، وأي طلب غير GET. `registerServiceWorker()` مُوصَّل في `__root.tsx` (يعمل مرة واحدة عند إقلاع التطبيق، يتخطّى النسخة الأصلية عبر Capacitor). |
| `src/lib/consent/consent.ts` + `audit.ts` | **PART 4** — مدير موافقات محلي حقيقي أول مرة (4 فئات: analytics/ads/personalization/diagnostics)، بافتراضي Opt-In=false للجميع (لا شيء يُفترض موافَقاً عليه). `auditConsentManager()` يقيّم الآلية نفسها مقابل GDPR/CCPA/PDPL (يحلّ محل الحقائق القديمة في `auditConsentReadiness()` من Prompt 23 التي افترضت عدم وجود آلية أصلاً). |
| `src/lib/compliance/cookie-policy.ts` | مولّد جديد (نفس نمط Prompt 23): يوثّق أن التطبيق لا يستخدم كوكيز إطلاقاً (الجلسة في localStorage). |
| `src/components/legal/LegalPageShell.tsx` + `src/routes/legal/{privacy,terms,cookies,data-export}.tsx` | **PART 5** — 4 صفحات عامة منشورة فعلياً (بلا حراسة مصادقة، بلا جدول جديد، بلا API): تعرض المستندات المولَّدة من Prompt 23/24 مباشرة من دوال `generate*()` الحقيقية، مع تنويه "مسودة تلقائية". صفحة `/legal/data-export` تعرض أيضاً نتائج `auditUserDataExport()` الحيّة. |
| `src/lib/compliance/deletion-report.ts` | **PART 6** — `generateAccountDeletionReport()`: يبني على `generateDeletionPlan()` (Prompt 23) ويضيف عدّ صفوف حقيقي لكل جدول (`count`/`head:true` فقط، **لا `.delete()` إطلاقاً**) لتقدير زمن تنفيذ افتراضي، زائد قائمة مخاطر مُصنَّفة (فشل جزئي، ملفات يتيمة، بقاء حساب Auth). |
| `src/lib/release/final-audit.ts` | **PART 7** — `runFinalProductionAudit()`: 9 فئات موزونة (سلامة مالية 20، نسخ احتياطي 10، إشعارات 10، إعلانات 10، امتثال 15، جوال 10، PWA 10، إتاحة وصول 5، إتمام Beta 10) كلها من محركات حقيقية موجودة، زائد Blockers/Warnings/Recommendations مُشتقّة. |
| `src/routes/_authenticated/app.system.tsx` | **PART 8** — قسم **التدقيق النهائي للإنتاج (Production Final Audit)** جديد: Production Score بارز + شارة "جاهز/غير جاهز"، شبكة الفئات التسع، عوائق الإطلاق، والإجراءات المُوصى بها. |

**تقرير الإغلاق (الأسئلة العشرة+ الإضافية) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر
migrations، Schema Freeze محفوظ بالكامل (Backup Engine عُدِّل بإذن صريح من هذا الـ Prompt فقط، وبقي
كل شيء آخر — transactions/investment_transactions/investments/person_ledger/system_events/
v_account_statement/Triggers/RLS/Views/المحركات المالية — بلا أي لمسة)، إصلاح Backup Engine مكتمل
(المفاتيح الصحيحة مُضافة مع توافق خلفي كامل)، PWA أصبح قابلاً للتثبيت (Service Worker حقيقي مسجَّل)،
الصفحات القانونية منشورة فعلياً على `/legal/*`، ولا تغيير في أي سلوك مالي قائم.

---

## 25. Prompt 25 — Production Safety & Operations Layer (Safe Mode) (منجز)

بناء طبقة تشغيل وإدارة إنتاج (Operations Layer) كاملة: أعلام ميزات، تجريد تقارير أعطال، إعدادات عن
بُعد، قنوات إصدار، جاهزية متاجر، وبوابة إنتاج نهائية تجمع كل تدقيقات الجلسة. على عكس Prompt 24، لم
يُعدَّل أي محرك موجود هذه المرة — الملف الوحيد المعدَّل هو `app.system.tsx` (توسيع UI معتاد). صفر
جداول جديدة، صفر migrations، صفر تعديل على transactions/investment_transactions/investments/
person_ledger/system_events/v_account_statement/أي Trigger/RLS/View/محرك مالي/زكاة/إهلاك/نسخ
احتياطي/إشعارات.

| الملف | الدور |
|---|---|
| `src/lib/features/{types,storage,config,engine,audit}.ts` | **PART 1** — محرك أعلام ميزات كامل: 7 أنواع (always/development/internal/beta/premium/production/disabled)، `enableFeature()`/`disableFeature()`/`isFeatureEnabled()`/`getFeatureState()`، دعم Rollout % عبر Bucket جهاز ثابت مُولَّد مرة واحدة. سجل ثابت من 8 ميزات حقيقية مبنية عبر الجلسة (لوحة الرؤى، أماكن الإعلانات، لوحة ملاحظات Beta، صفحة /app/system نفسها، إلخ). |
| `src/lib/crash/{context,provider,local,audit}.ts` | **PART 2** — واجهة `captureError()`/`captureException()`/`captureMessage()`/`setUser()`/`setContext()`/`clearContext()` قابلة للتوصيل بمزوّد. `LocalCrashProvider` (الوحيد الفعّال) يُعيد استخدام `captureApplicationError()` من `system/errors.ts` (Prompt 17) بدل سجل ثانٍ منفصل. `SentryProviderStub`/`FirebaseCrashlyticsStub` بلا أي SDK محمَّل. |
| `src/lib/remote-config/{config,engine,audit}.ts` | **PART 3** — 6 مفاتيح (`ads_enabled`, `premium_enabled`, `notifications_enabled`, `maintenance_mode`, `beta_features`, `rollout_percentage`)، مصدر `LocalStorageConfigSource` وحيد حالياً خلف واجهة `RemoteConfigSource` قابلة للاستبدال لاحقاً بـ Supabase/Firebase/JSON CDN دون تغيير أي كود مستدعٍ. |
| `src/lib/emergency/{mode,actions,audit}.ts` | **PART 5** — مفاتيح طوارئ محلية استشارية فقط (صيانة/إعلانات/إشعارات/Beta) — **لا تلمس** كود المحركات الفعلية (بلا تعديل ads/notifications engines)، فقط تُخزَّن وتُعرَض في اللوحة ليتصرّف المشغِّل يدوياً. **لا توجد دالة واحدة** لتعطيل المحرك المالي أو النسخ الاحتياطي أو المصادقة — بالتصميم، مذكور صراحة في تعليق الكود. |
| `src/lib/release/channels.ts` | **PART 6** — `getCurrentReleaseChannel()`/`setReleaseChannel()`/`auditReleaseChannel()` — القناة الافتراضية مُشتقّة من إشارة حقيقية (`import.meta.env.DEV`) لا تخمين. |
| `src/lib/release/store-readiness.ts` | **PART 7** — `auditStoreReadiness()`: 6 فحوصات Google Play (Privacy Policy/Data Safety/Ads Declaration/Target SDK/Backup/Notifications) و6 فحوصات Apple (Privacy Manifest/ATT/In-App Purchases/Notifications/Account Deletion/Legal URLs)، كلها تُعيد استخدام عناصر حقيقية من `metadata-audit.ts`/`android-audit.ts`/`ios-audit.ts`/`compliance-audit.ts` (Prompt 22-23) دون إعادة اشتقاقها. اكتشاف مهم: **Account Deletion = error** فعلياً وفق دليل Apple 5.1.1(v) (معاينة فقط، بلا تنفيذ). |
| `src/lib/release/production-gate.ts` | **PART 8** — `evaluateProductionGate()`: بوابة نهائية تُعيد استخدام 9 تقارير حقيقية (Final Audit، Compliance، Release Checklist، Beta Health، Feature Coverage، Mobile Audit، Ads Audit، Backup Integrity، Release Blockers) لإنتاج `{productionReady, score, blockers, warnings, recommendations, checklist}`. |
| `src/routes/_authenticated/app.system.tsx` | **PART 4 + 9** — قسمان جديدان: **عمليات الإنتاج (Production Operations)** (حالة الأعطال، أعلام الميزات، الإعدادات عن بُعد، سلامة النسخ الاحتياطي عبر `verifyBackupIntegrity()`، سلامة الإشعارات عبر `processPendingNotifications()`، أزرار تفعيل/تعطيل وضع الطوارئ)، و**بوابة الإنتاج (Production Gate)** (Production Score بارز، القناة الحالية، جاهزية المتاجر بالتفصيل، حالة الامتثال، قائمة تدقيق البوابة، العوائق الحرجة، التوصيات). |

**تقرير الإغلاق (الأسئلة العشرة+ الإضافية) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر
migrations، Schema Freeze محفوظ بالكامل (لا تعديل على أي محرك مالي/زكاة/إهلاك/نسخ احتياطي/إشعارات
هذه المرة — الملف الوحيد المُعدَّل هو `app.system.tsx`)، Feature Flags/Crash Reporting/Remote
Config/Emergency Controls/Production Gate جميعها جاهزة وتعمل فعلياً، ولا تغيير في أي سلوك مالي قائم.

---

## 27. Prompt 26 — Account Deletion, Consent UI, Production Legal Wiring & Launch Closure (منجز)

الحلقة الأخيرة قبل الإطلاق: واجهة معاينة حذف حساب حقيقية (بلا تنفيذ)، شاشة موافقة (Consent Banner)
حقيقية معروضة للمستخدم فعلياً لأول مرة، ربط الصفحات القانونية المنشورة (Prompt 24) داخل التطبيق
والتكوين، محرك عوائق إطلاق موحّد، شهادة إصدار، تدقيق نهائي، ولوحة "Launch Readiness Resolution
Center". صفر جداول جديدة، صفر migrations، صفر تعديل على transactions/investment_transactions/
investments/person_ledger/system_events/v_account_statement/أي Trigger/RLS/View/محرك مالي/زكاة/إهلاك.

| الملف | الدور |
|---|---|
| `src/lib/account-deletion/{flow,audit}.ts` | **PART 1** — `generateDeletionExecutionPlan()`/`validateDeletionReadiness()`/`exportDeletionPackage()` تبني على `generateAccountDeletionReport()` (Prompt 24) لعرض خطوات، حجم بيانات متوقّع، بيانات غير قابلة للحذف من العميل، زمن تقديري، وتحذيرات استرجاع — **بلا أي `.delete()` أو `service_role` أو migration**. `exportDeletionPackage()` يُنتج نسخة احتياطية كاملة + الخطة كملف واحد قابل للتنزيل. |
| `src/components/AccountDeletionDialog.tsx` | نافذة معاينة كاملة: إحصاءات، خطوات مرقّمة، بيانات غير قابلة للحذف، تحذيرات، زر تصدير حزمة الحذف، وحقل تأكيد نصي ("حذف حسابي") قبل زر "تأكيد الاطّلاع" — لا زر حذف فعلي إطلاقاً. مُوصَّلة في Settings > المساعدة. |
| `src/lib/consent/preferences.ts` | **PART 2** — يُحوِّل فئات consent.ts الأربع (Prompt 24) + إعدادات الإشعارات الحقيقية إلى 5 فئات واجهة (Essential/Analytics/Ads/Notifications/Personalization)، مع Essential غير قابلة للتعطيل. يُعيد استخدام `loadConsent()`/`saveConsent()` دون تكرار منطقهما. |
| `src/components/ConsentBanner.tsx` + `ConsentPreferencesDialog.tsx` | **أول شاشة موافقة حقيقية معروضة للمستخدم** — مثبَّتة في `__root.tsx` (تظهر على كل الصفحات حتى يُتَّخذ قرار)، بخيارات قبول الكل / رفض غير الأساسي / تخصيص. |
| `src/lib/release/metadata-config.ts` (معدَّل) | **PART 3** — `PRIVACY_POLICY_URL`/`TERMS_URL` أصبحا `/legal/privacy`/`/legal/terms` فعلياً (بدل placeholder)، أُضيف `COOKIES_URL`/`DATA_EXPORT_URL` جديدان يشيران لصفحات Prompt 24 المنشورة فعلياً. `SUPPORT_URL`/`WEBSITE_URL` بقيا placeholder بصدق — لا نطاق حقيقي بعد. |
| `privacy-policy.ts`/`terms-of-service.ts`/`cookie-policy.ts` (معدَّلة) | تحديثات نصية طفيفة تربط بين المستندات (روابط متبادلة حقيقية) وتشير لأدوات حذف الحساب/تفضيلات الخصوصية الجديدة بدل نص عام. |
| `src/lib/release/legal-links.ts` | `validateLegalLinks()` — يتحقق أن Privacy/Terms/Cookies/Data Export تشير فعلياً لمسارات `/legal/*` داخلية (وليس فقط "غير فارغة")؛ Support يبقى مُعلَناً بصدق كـ placeholder. |
| `src/lib/release/blockers.ts` | **PART 4** — `computeLaunchBlockers()` يُوحِّد 7 تقارير موجودة (Release Blockers/Production Gate/Launch Checklist/Compliance/PWA/Android/iOS) في قائمة عوائق مسطّحة بشكل `{blocker_id, severity, category, title, description, fix, resolved}`. |
| `src/lib/release/certificate.ts` | **PART 6** — `generateReleaseCertificate()` يُنتج 11 قسماً (financial_engine/schema_freeze/backup/notifications/investments/depreciation/zakat/analytics/beta/production/compliance) + `final_score`، معظمها من محركات فعلية، وschema_freeze/depreciation/zakat حقائق ثابتة موثَّقة (لم تُعدَّل عبر الجلسة). |
| `src/lib/release/final-check.ts` | **PART 7** — `performFinalAudit()` يتحقق من Schema Freeze/عدم وجود migrations أو تعديل Triggers/RLS/محركات مالية (حقائق ثابتة موثَّقة بالبناء) + فحصين حيّين (لا روابط قانونية معطوبة، لا عوائق حرجة غير محلولة) عبر `validateLegalLinks()`/`computeLaunchBlockers()`. |
| `src/components/HelpSection.tsx` (معدَّل) | إضافة زرَّي "تفضيلات الخصوصية" و"حذف الحساب" + قسم روابط للمستندات القانونية الأربعة. |
| `src/routes/_authenticated/app.system.tsx` | **PART 5** — قسم **Launch Readiness Resolution Center** جديد: Critical (Account Deletion/Legal Links/Consent/Android/iOS/Store Readiness)، Warning (Ads/Accessibility/Empty States/Backup Coverage)، Passed (من `generateReleaseCertificate()` مباشرة: Financial Engine/Investments/Zakat/Analytics/Notifications/Backup) — زائد شريط ملخّص (عوائق غير محلولة، حالة التدقيق النهائي، Release Certificate Score). |

**تقرير الإغلاق (14 سؤالاً) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations، Schema
Freeze محفوظ بالكامل، Account Deletion جاهز كمعاينة كاملة (بلا تنفيذ فعلي بالتصميم)، Consent UI جاهز
ومعروض فعلياً لأول مرة، الروابط القانونية الأربعة (Privacy/Terms/Cookies/Data Export) مربوطة فعلياً
بصفحات داخلية حقيقية (Support يبقى صادقاً كـ placeholder)، ولا تغيير في أي سلوك مالي قائم.

---

## 29. Prompt 27 — Production Deployment, Store Operations & Launch Execution (منجز)

الانتقال من "تطبيق جاهز تقنياً" إلى "تطبيق قابل للنشر والإطلاق الفعلي": ملفات بيئة إنتاج، خطوط أنابيب
إصدار Android/iOS كاملة (تدقيق + خطة تنفيذ خطوة بخطوة)، محرك بيانات وصفية لمتجرَي Google Play وApple
App Store (نصوص حقيقية مبنية على الميزات الفعلية للتطبيق، مع تحقق من حدود الأحرف)، بنية دعم وتواصل،
خطة تنفيذ حذف حساب فعلي مستقبلية (توثيقية بحتة — بلا service_role وبلا تنفيذ)، مراقبة/رصد شامل، ومحرك
Go/No-Go نهائي. صفر جداول جديدة، صفر migrations، صفر تعديل على transactions/investment_transactions/
investments/person_ledger/system_events/v_account_statement/أي Trigger/RLS/View/محرك مالي/زكاة/إهلاك/
**Backup Engine/Notification Engine** (كلاهما مجمَّد صراحةً في هذا البرومبت، بخلاف الاستثناء لمرة واحدة في Prompt 24).

| الملف | الدور |
|---|---|
| `src/lib/deployment/{environment,validation,checklist}.ts` | **PART 1** — `getCurrentEnvironment()`/`setCurrentEnvironment()` (development/staging/beta/production، افتراضي من `import.meta.env.DEV` الفعلي)، `validateEnvironment()` يفحص Supabase URL/Key حيّاً + روابط قانونية/دعم/موقع عبر `metadata-config.ts` + معرّفات إعلانات عبر `auditAdsConfiguration()`، مع Analytics IDs معلَنة بصدق كـ "غير قابلة للتطبيق" (لا SDK تحليلات في التطبيق). `generateEnvironmentChecklist()` يجمعهما. |
| `src/lib/android/{audit,release,checklist}.ts` | **PART 2** — `auditAndroidProduction()` يبني على `auditAndroidRelease()` (Prompt 22) ويضيف App Bundle/Signing/Deep Links/Play Console Readiness. `generateAndroidReleasePlan()` خطة تنفيذ من 9 خطوات مرتّبة (إضافة منصّة → توليد أصول → تعطيل Live Reload → keystore → رفع versionCode → مراجعة Manifest → بناء AAB → تعبئة القائمة → الإرسال). `checklist.ts` بنود Play Console اليدوية (تصنيف المحتوى، نموذج أمان البيانات، إلخ). |
| `src/lib/ios/{audit,release,checklist}.ts` | **PART 3** — `auditIOSProduction()` يبني على `auditIOSRelease()` (Prompt 22) ويضيف Apple Sign-In Readiness (حقيقة مُتحقَّقة: `signInWithOAuth("apple")` مدعوم في `lovable/index.ts` لكن غير مفعَّل في واجهة `auth.tsx`)، Push Readiness (حقيقة: `NotificationProvider.sendPush` لا يزال Noop، لا APNs)، Associated Domains، Privacy Manifest، App Store Connect Readiness. `generateIOSReleasePlan()`/`checklist.ts` بنفس نمط Android. |
| `src/lib/store/{descriptions,screenshots,metadata}.ts` | **PART 4** — نصوص تسويقية حقيقية مبنية على ميزات التطبيق الفعلية فقط (محافظ/مصاريف/ديون/متكررة/أصول موحّدة/زكاة/تقارير/تذكيرات) — لا ميزات مختلَقة. `validateStoreCopyLengths()` يتحقق فعلياً من حدود Google Play (عنوان ≤30، وصف قصير ≤80، وصف كامل ≤4000) وApple (عنوان فرعي ≤30، نص ترويجي ≤170). `generateStoreMetadata()` يجمع النصوص + `generateScreenshotsReport()` (يعيد استخدام `generateStoreAssetsChecklist()` من Prompt 22 بدل إعادة الفحص) في حمولتَي Google Play/Apple كاملتين. |
| `src/lib/support/{config,audit}.ts` | **PART 5** — `getSupportConfig()` يُعيد تصدير روابط `metadata-config.ts` + `SUPPORT_EMAIL` جديد (لا يزال placeholder بصدق — لا صندوق دعم حقيقي بعد). `auditSupportInfrastructure()` يفحص البريد/النطاق/صفحات الدعم/الصفحات القانونية (الأخيرة عبر `validateLegalLinks()` مباشرة). |
| `src/lib/account-deletion/execution.ts` | **PART 6** — توثيقي بحت، لا `service_role`، لا تنفيذ فعلي: `generateServerDeletionSpec()` (6 خطوات لمعالج خادم مستقبلي)، `generateSupabaseDeletionPlan()` (ترتيب حذف 18 جدولاً بالعكس حسب تبعيات المفاتيح الأجنبية، يعيد استخدام `DB_TABLES`/`LOCAL_STORAGE_KEYS` من Prompt 23)، `generateEdgeFunctionRequirements()` (متطلبات Edge Function مستقبلية: JWT، rate limiting، idempotency، سجل تدقيق منفصل، تأكيد بريدي). |
| `src/lib/monitoring/{config,audit}.ts` | **PART 7** — `getMonitoringConfig()` سجل صادق لكل فئة رصد (Crash/Analytics/Performance/Errors/Notifications/Backups) يوثّق أن الكل محلي بالتصميم — لا Sentry/Firebase/PostHog. `auditObservability()` يُركِّب `auditCrashReporting()`/`collectPerformanceMetrics()`/`loadNotificationSettings()`/`verifyBackupIntegrity()` الموجودة فعلياً بدل إعادة حسابها. |
| `src/lib/release/go-no-go.ts` | **PART 9** — `evaluateLaunchDecision()` القمة النهائية: يُركِّب `runFinalProductionAudit()`/`evaluateProductionGate()`/`computeLaunchBlockers()`/`performFinalAudit()` + تدقيقات Android/iOS/Support الجديدة في قرار واحد `GO`/`NO_GO`/`BETA_ONLY`. iOS متعمَّد استبعاده من شرط `GO` (لا منصّة iOS مضافة أصلاً في هذا المشروع) — يظهر كتحذير لا كعائق. |
| `src/routes/_authenticated/app.system.tsx` | **PART 8** — قسم **Production Launch Center** جديد: بطاقة قرار Go/No-Go بارزة، البنية التحتية (Environment/Support/Monitoring)، Android (جاهزية إصدار + جاهزية متجر)، iOS (نفس البنية)، الامتثال (Privacy/Consent/Account Deletion)، والإنتاج (النتيجة النهائية/العوائق المتبقية/جاهزية الإطلاق التقديرية) + توصيات. |

**تقرير الإغلاق (16 سؤالاً) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations، Schema
Freeze محفوظ بالكامل بما فيه Backup Engine وNotification Engine (مجمَّدان صراحةً هذه المرة)، خطوط أنابيب
Android/iOS موثَّقة بالكامل مع فجوات حقيقية غير مُخفاة (لا iOS platform، لا keystore توقيع)، بيانات متجر
حقيقية جاهزة للصق المباشر، بنية دعم مُعرَّفة (لا يزال Support Email/URL placeholder بصدق)، خطة حذف حساب
تنفيذية موثَّقة بالكامل بلا أي تنفيذ فعلي، ومحرك Go/No-Go يُصدر قراراً واحداً واضحاً مبنياً على كل ما سبق.

---

## 31. Prompt 28 — Release Candidate (RC1), Launch Freeze & Production Certification (منجز)

إغلاق المشروع هندسياً وإنتاجياً وإصدار أول شهادة جاهزية رسمية (RC1)، مع تجميد إضافي صريح لمحرك
التحليلات (Analytics Engine) — إضافة لكل القائمة المعتادة (Schema/Financial/Investment/Notification/
Backup). يتضمّن أول تدقيق أمان حقيقي (`bun audit`، 26 ثغرة: 14 عالية/8 متوسطة/4 منخفضة، أهمها xlsx
كتبعية مباشرة) وأول محرك قرار نهائي يُركِّب كل محركات الجلسة في قرار GO/NO_GO/BETA_ONLY واحد.

| الملف | الدور |
|---|---|
| `src/lib/rc/{version,build,certificate}.ts` | **PART 1** — `generateReleaseCandidate()` يبني `rc_version` ("RC1") + `generateBuildFingerprint()` (build_id/git_commit/build_date — git_commit مُعلَن بصدق كـ"غير متاح" لأن vite.config.ts لا يحقن VITE_GIT_COMMIT) + `generateVersionManifest()` (نسخ رمزية لكل محرك مجمَّد، مبنية على تاريخ آخر Prompt عدّله فعلياً). |
| `src/lib/rc/freeze.ts` | **PART 2** — `verifySchemaFreeze()`/`verifyFinancialFreeze()`/`verifyInvestmentFreeze()`/`verifyNotificationFreeze()`/`verifyBackupFreeze()`/`verifyAnalyticsFreeze()` — حقائق ثابتة موثَّقة عبر `git log`/`git diff` طوال الجلسة؛ `verifyBackupFreeze()` وحدها تُقرّ بصدق أن Backup Engine عُدِّل مرة واحدة (Prompt 24) قبل أن يُجمَّد. |
| `src/lib/rc/dependencies.ts` | **PART 3** — `auditDependencies()`: أول تدقيق أمني حقيقي هذه الجلسة، نتائج `bun audit` الفعلية على قفل هذا المستودع (2026-07-04): 26 ثغرة (14 عالية/8 متوسطة/4 منخفضة). التصنيف الحقيقي: `xlsx` (تبعية مباشرة، ثغرتا Prototype Pollution/ReDoS، لكن الاستخدام كتابة فقط في كل الكود — لا `XLSX.read()` على أي إدخال مستخدم) وتبعية `@tanstack/start-server-core` (متوسطة) كـ"warning"؛ أدوات البناء (`@capacitor/cli`, eslint, babel, esbuild...) كـ"safe" (لا شحن للإنتاج). |
| `src/lib/rc/security.ts` | **PART 4** — `auditSecurity()` يُركِّب `auditConsentManager()`/`auditAccountDeletion()`/`auditPWA()` الموجودة فعلياً + حقائق ثابتة عن JWT في localStorage غير مشفَّر، عدم تشفير النسخ الاحتياطي (موثَّق صراحة في `backup/engine.ts`)، وفحص حي لـ`Notification.permission`. |
| `src/lib/rc/performance.ts` | **PART 5** — `certifyPerformance()` يُركِّب `runSystemHealthCheck()`/`collectPerformanceMetrics()`/`evaluateProductionGate()` + يقيس زمن `computeFinancialInsights()` (محرك التحليلات المجمَّد) فعلياً دون تعديله؛ يُعلن الزمن كـ"غير متاح" إن لم توجد جلسة Supabase مصادَق عليها. |
| `src/lib/rc/production-certificate.ts` | **PART 6** — `generateProductionCertificate()` يبني على `generateReleaseCertificate()` (Prompt 26) لـ8 من أصل 10 أقسام، ويضيف architecture (من `runFreezeVerification()`)، release (من RC1)، security، وperformance، مع مستوى اعتماد (`certification`: gold ≥95 / silver ≥85 / bronze ≥70 / not_certified). |
| `src/lib/rc/report.ts` | **PART 8** — `generateFinalReleaseReport()`: قوائم Completed Modules/Technical Debt/Known Limitations/Next Steps ثابتة وصادقة (جرد شامل لما بُني/لم يُبنَ)، ودرجات Production/Beta/Store/Compliance حيّة من `evaluateFinalReleaseDecision()`/`calculateBetaHealth()`/`auditStoreReadiness()`/`auditCompliance()`. |
| `src/lib/rc/decision.ts` | **PART 9** — `evaluateFinalReleaseDecision()`: القرار الختامي للجلسة بأكملها، يُركِّب `evaluateLaunchDecision()` (Prompt 27) + `generateProductionCertificate()` + `auditDependencies()` في `{decision, confidence, blockers, warnings, recommendation}` واحد. |
| `src/routes/_authenticated/app.system.tsx` | **PART 7** — قسم **Release Candidate Certification** جديد: RC Information (Version/Build/Commit/Date)، Freeze Status (6 محركات)، Security Score، Performance Score، Dependency Audit، أقسام Production Certificate العشرة، Final Release Report (Technical Debt/Known Limitations/Next Steps)، والتوصية النهائية. |

**تقرير الإغلاق (16 سؤالاً) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations، Schema
Freeze محفوظ بالكامل بما فيه Analytics Engine (مجمَّد صراحةً لأول مرة هذا الـ Prompt)، تدقيق أمني حقيقي
لأول مرة (`bun audit`) كشف ثغرة حقيقية في تبعية مباشرة (xlsx)، وشهادة إنتاجية + قرار نهائي واحد يُلخّص
حالة المشروع الكاملة بعد 28 برومبت متتالياً.

---

## 33. Prompt 29 — Final Production Hardening, Store Submission Preparation & RC2 Certification (منجز)

استكمال العوائق المتبقية قبل الإنتاج الفعلي عبر تدقيقات أعمق لكل منصّة ومكوّن أُنشئ في Prompt 27-28،
وإصدار شهادة RC2 التي تُركِّب كل شيء في قرار واحد نهائي. تجميد إضافي صريح: Release Candidate Engine
وProduction Certificate Engine (محركا Prompt 28) أُضيفا لقائمة الممنوعات، ولم يُعدَّل أي منهما.

| الملف | الدور |
|---|---|
| `src/lib/android-production/{keystore,release-config,certificate}.ts` | **PART 1** — `verifyAndroidSigning()` (لا keystore/alias/SHA1/SHA256 — حقائق ثابتة، لا منصّة android/ موجودة)، `auditAndroidReleaseConfig()` (allowMixedContent/cleartext/liveReload من capacitor.config.ts مباشرة؛ minify/shrinkResources/proguard/versionCode معلَنة بصدق كـ"غير قابلة للتطبيق" لعدم وجود build.gradle)، `generateAndroidProductionCertificate()` يُركِّبهما مع `auditAndroidProduction()` (Prompt 27). |
| `src/lib/ios-production/{project,privacy,certificate}.ts` | **PART 2** — `auditIOSProject()` (لا مجلد ios/، لا مشروع Xcode، لا entitlements)، `auditIOSPrivacy()` (لا PrivacyInfo.xcprivacy؛ لا حاجة فعلية لأذونات كاميرا/بيومترية/تتبّع — لا ميزة تستخدمها في الكود)، `generateIOSProductionCertificate()` يُركِّبهما مع `auditIOSProduction()` (Prompt 27). |
| `src/lib/account-deletion/execution-plan.ts` | **PART 3** — `buildDeletionExecutionPlan()`: 6 فئات (auth/storage/database/notification/backup/audit) تُعيد استخدام خطوات `generateServerDeletionSpec()`/`generateSupabaseDeletionPlan()` (Prompt 27) حرفياً، مع `executable: false` و`requires_service_role: true` ثابتتين. |
| `src/lib/security/backup-encryption.ts` | **PART 4** — `auditBackupEncryption()`: قراءة فقط، لا تعديل على Backup Engine؛ يُقرّ بصدق أنه لا تشفير/خوارزمية/إدارة مفاتيح على الإطلاق (موثَّق أصلاً في تعليق backup/engine.ts). |
| `src/lib/security/dependencies.ts` | **PART 5** — `auditDependencySecurity()` يُعيد استخدام بيانات `bun audit` الحقيقية من `rc/dependencies.ts` (Prompt 28) ويضيف إجراء حل مقترح لكل حزمة من الست المطلوبة (xlsx/dompurify/tanstack/vite/capacitor/supabase). |
| `src/lib/support-production/{channels,sla,certificate}.ts` | **PART 6** — `auditSupportChannels()` (بريد/موقع/اتصال خصوصية عبر support/config.ts؛ اتصال قانوني/أعمال معلَنان كغير موجودين بصدق)، `generateSupportSLA()` (4 مستويات مقترحة، موثَّقة كأهداف مستقبلية لا كقياس فعلي)، `generateSupportCertificate()` يُركِّبهما مع `auditSupportInfrastructure()` (Prompt 27). |
| `src/lib/store-submission/{android,ios,assets}.ts` | **PART 7** — `auditStoreSubmissionAssets()` يبني على `generateStoreAssetsChecklist()` (Prompt 22) ويضيف Promo Assets/Privacy Screenshots (كلاهما مفقود فعلياً)؛ `generatePlayStoreSubmission()`/`generateAppStoreSubmission()` يُركِّبان بيانات المتجر (Prompt 27) + الشهادة الإنتاجية للمنصّة (PART 1/2) + الأصول في حزمة تقديم واحدة مع قائمة عوائق. |
| `src/lib/rc2/{score,certificate,decision}.ts` | **PART 8** — `calculateRC2Score()` يُركِّب كل شهادات هذا البرومبت + `final_score` الخاص بـ RC1 (Prompt 28) في درجة واحدة؛ `generateRC2Certificate()` يُصدر بصمة RC2؛ `evaluateRC2Decision()` يُعيد استخدام `evaluateFinalReleaseDecision()` (RC1) للعوائق مباشرة — عائق حرج واحد موروث من RC1 يفرض `NO_GO` بغض النظر عن الدرجة، تماماً كما تشترط قواعد هذا البرومبت. |
| `src/routes/_authenticated/app.system.tsx` | **PART 9** — قسم **RC2 Production Certification Center** جديد: Android (Signing/Release Config/Certificate)، iOS (Project/Privacy/Certificate)، Security (Backup Encryption/Dependency Audit)، Support (Certificate/SLA)، Store Submission (Android/iOS Package)، وRC2 (Score/Certificate/Final Decision). |

**تقرير الإغلاق (16 سؤالاً) — أيضاً في نهاية رسالة الجلسة:** صفر جداول جديدة، صفر migrations، Schema
Freeze محفوظ بالكامل بما فيه Release Candidate Engine وProduction Certificate Engine (مجمَّدان صراحةً
لأول مرة). RC2 يُظهر بصدق أن العوائق الحرجة الموروثة من RC1 (Android/iOS Readiness) لا تزال قائمة —
القرار النهائي NO_GO حتى تُحلّ، تماماً كما تنص قاعدة هذا البرومبت الصريحة.

---

## 34. كيف تُحدَّث هذه الوثيقة

- عند إنجاز بند من "الفجوات" أعلاه: انقله إلى قسم "منجزة" مع رابط الملف/الالتزام (commit).
- عند بدء خطة تطوير جديدة (سواء مطروحة من المستخدم أو من `.lovable/plan.md` مستقبلاً): أضف قسماً
  جديداً بنفس نمط الجدول في القسم 1 (بند / حالة / موقع في الكود).
- لا تُبقِ بنوداً "قيد التنفيذ" بلا تاريخ أو سياق — إما أنجزها، أو وثّق سبب التوقف بوضوح.
