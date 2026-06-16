## خطة التحديث الشامل لتطبيق "رصد"

### 1) دمج الأشخاص + الديون في موديول واحد
- إزالة صفحات `app.debts.tsx` و `app.debts.$id.tsx` من التنقل
- نقل **تاريخ الاستحقاق** و**تذكيرات الاستحقاق** إلى `person_ledger` مباشرة
- إضافة أعمدة لـ `person_ledger`:
  - `due_date date` — تاريخ استحقاق اختياري لحركات "سلّفته/استلفت منه"
  - `reminder_enabled boolean default false`
  - `settled_at timestamptz` — لتأشير الحركة كمسددة
- صفحة `/app/people` تصبح هي صفحة الديون: تعرض الأرصدة + التحذيرات للمستحق قريباً/المتأخر
- صفحة `/app/people/$id` (دفتر الحساب) تعرض جدول الحركات مع شارة "مستحق خلال X يوم" أو "متأخر"
- شريط تذكيرات في الأعلى: "لديك 3 ديون مستحقة هذا الأسبوع"
- زر تذكير واتساب يحتسب الديون المتأخرة تلقائياً

### 2) ربط جهات الاتصال بدفتر هاتف الجهاز
- إضافة زر "استيراد من جهات الاتصال" في صفحة `/app/contacts` يستخدم **Contact Picker API** للمتصفح:
  - `navigator.contacts.select(['name','tel','email'], {multiple: true})`
  - يعمل فقط على Chrome Android (HTTPS + PWA). على باقي الأجهزة: زر vCard مخفي ورسالة شرح.
- بديل احتياطي: استيراد ملف `.vcf` (vCard) برفع ملف من الجهاز
- مكوّن جديد `ContactImportButton.tsx`

### 3) عمليات المحافظ (غير المصاريف)
- جدول جديد `wallet_transactions`:
  - `id, user_id, wallet_id, kind, amount, currency, happened_at, notes, counterparty_wallet_id, contact_id, created_at`
  - `kind`: `deposit` (إيداع كاش) | `withdraw` (سحب) | `transfer_out` | `transfer_in` | `send` (حوالة غير مستردة صادرة) | `receive` (حوالة واردة) | `adjustment` (تسوية يدوية)
  - التحويل بين محفظتين = صفّان مرتبطان بنفس `transfer_group_id`
- صفحة `/app/wallets/$id` جديدة: سجل عمليات المحفظة + الرصيد الجاري
- زر "تحويل بين محافظ" في صفحة المحافظ → نموذج يختار `من` و `إلى` ومبلغ
- زر "إيداع/سحب/حوالة" مع نوع
- إعادة احتساب الرصيد:
  `opening_balance + Σ(deposits + transfer_in + receive) − Σ(withdraw + transfer_out + send) − Σ(expenses)`

### 4) المصاريف الدورية / المؤجلة عبر أشهر
- إضافة أعمدة لـ `expenses`:
  - `allocation_kind text default 'single'` — `single` | `spread`
  - `spread_months int` — عدد الأشهر للتوزيع
  - `spread_start date` — تاريخ بداية التوزيع
- جدول جديد `expense_allocations` (مولّد تلقائياً عند الحفظ):
  - `id, expense_id, user_id, period date, amount, currency, created_at`
  - يخزن مبلغ كل شهر (مثلاً إيجار 12,000 لـ 6 أشهر → 6 صفوف بـ 2,000)
- التقارير الشهرية تجمع من `expense_allocations` بدل `expenses` مباشرة
- في نموذج المصروف: مفتاح "توزيع على أشهر مقدماً" → يظهر حقلان (عدد الأشهر، شهر البداية)
- معاينة: "سيُحسب 2,000 ر.س شهرياً من يناير حتى يونيو"

### 5) تحسينات UI
- شريط جانبي/تنقل سفلي محسّن مع أيقونات أوضح
- بطاقات الإحصائيات: gradient + iconography أعمق
- صفحة Dashboard:
  - بطاقة السيولة الإجمالية مع breakdown لكل محفظة
  - بطاقة "صافي الديون" (له − عليه)
  - بطاقة "مصاريف الشهر الحالي" (من allocations)
  - تذكيرات استحقاق سريعة
- Skeleton loaders أنعم
- Empty states موحدة بأيقونة + نص + CTA
- Toaster بتموضع أفضل للموبايل

### التغييرات التقنية
- **3 migrations**: تعديل `person_ledger` + تعديل `expenses` + جدولين جديدين (`wallet_transactions`, `expense_allocations`) مع RLS و GRANT
- **ملفات جديدة**: 
  - `src/routes/_authenticated/app.wallets.$id.tsx`
  - `src/components/WalletTxForm.tsx`
  - `src/components/WalletTransferForm.tsx`
  - `src/components/ContactImportButton.tsx`
  - `src/components/DueReminders.tsx`
- **ملفات معدّلة**:
  - `PersonTxForm.tsx` (إضافة due_date + reminder)
  - `app.people.tsx` + `app.people.$id.tsx` (دمج خصائص الديون)
  - `app.wallets.tsx` (أزرار العمليات الجديدة)
  - `app.expenses.tsx` (allocation_kind + spread)
  - `app.index.tsx` (Dashboard محسّن)
  - `app.reports.tsx` (قراءة من allocations)
  - `route.tsx` (إزالة "ديون" من التنقل)
- **ملفات محذوفة**: `app.debts.tsx`, `app.debts.$id.tsx` (سيُحوَّل أي رابط قديم لصفحة الأشخاص)

### ملاحظات
- البيانات الموجودة في `debts` تبقى كما هي (لن تُحذف الجداول)، فقط الصفحات تُخفى. لاحقاً يمكن عمل migration لنقلها إلى `person_ledger` إذا رغبت.
- Contact Picker API محدودة بـ Chrome Android — هذا قيد متصفح وليس قيد التطبيق.
