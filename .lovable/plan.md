
## خطة تطوير "رصد" — منصة مالية شخصية متكاملة

سأقسّم العمل إلى **3 مراحل** قابلة للتنفيذ بشكل مستقل، مع تأكيد المرحلة قبل البدء بالتي تليها. ما يوجد حالياً سيُستثمر بدل إعادة بنائه.

---

### ما هو موجود فعلاً (لتجنّب التكرار)
- `wallets` + `wallet_transactions` (deposit/withdraw/send/receive/transfer/adjustment) — جاهز
- `expenses` + `expense_allocations` (توزيع على أشهر) — جاهز
- `person_ledger` (سلّفت/استلفت/سددت/حصّلت + due_date + reminder) — جاهز
- `contacts` + استيراد vCard وContact Picker — جاهز
- صفحة محافظ + صفحة أشخاص موحّدة مع الديون — جاهزة

---

## المرحلة 1 — كشوف الحسابات + أنواع الحسابات + الحركات المصنّفة

### 1.1 أنواع الحسابات
- إضافة عمود `account_type` لـ `wallets`: `bank` | `cash` | `credit_card` | `investment` | `zakat`
- إضافة `is_archived boolean` لإخفاء حسابات غير نشطة
- نموذج المحفظة يعرض اختيار النوع مع أيقونة مناسبة

### 1.2 تصنيفات الحركات المستقلة (إيداع/صرف/تحويل)
- جدول جديد `wallet_tx_categories` مع `kind` (`inflow` | `outflow`) و`name` و`icon`
- بذرة افتراضية للإيداع: راتب، مكافأة، أجور، تعويض، هدية، أرباح استثمار، استرداد، أخرى
- بذرة افتراضية للصرف (غير المصنّف كمصروف): هبة، تبرعات، إعانة، تحويل خارجي، أخرى
- إضافة `category_id` لـ `wallet_transactions`

### 1.3 كشف حساب المحفظة/البنك (Statement)
- صفحة `/app/wallets/$id` تتحوّل لكشف حساب احترافي:
  - أعمدة: التاريخ | البيان | التصنيف | مدين | دائن | الرصيد الجاري
  - دمج: `wallet_transactions` + `expenses` + `person_ledger` (سداد/تحصيل) في تيار واحد مرتّب زمنياً
  - حساب الرصيد الجاري تراكمياً
  - فلترة: من تاريخ — إلى تاريخ، تصنيف، نوع، بحث نصّي
  - تصدير: **PDF** (jspdf + autotable مع دعم العربية RTL) و**Excel** (xlsx)

### 1.4 كشف حساب الشخص (Drawer منبثق)
- في `/app/people` عند الضغط على شخص → **Drawer** يحتوي:
  - بطاقة ملخص: إجمالي المستحق له/عليه، المدفوع، المتبقي
  - جدول: التاريخ | البيان | مدين | دائن | الرصيد الجاري
  - زر تصدير PDF/Excel لكشف الشخص
  - يبقى الانتقال لصفحة كاملة `/app/people/$id` متاحاً

### 1.5 لوحة التحكم — مؤشر التدفقات النقدية
- إضافة بطاقة "إيرادات الشهر / مصروفات الشهر / صافي التدفق"

---

## المرحلة 2 — المصاريف الدورية المتقدمة + الحالات + المرفقات + التنبيهات

### 2.1 المصاريف الدورية الحقيقية (تتجدّد تلقائياً)
- جدول جديد `recurring_expenses`: `name, amount, currency, wallet_id, category_id, frequency` (monthly/quarterly/yearly), `start_date, end_date, next_due, auto_post boolean, contact_id`
- محرّك توليد: عند فتح التطبيق يولّد أي مصاريف `next_due <= today` كـ `expenses` فعلية
- صفحة `/app/recurring` لإدارة الاشتراكات الدورية (إيجار، إنترنت، تأمين...)
- إعادة توزيع تلقائية: تعديل المبلغ المتبقي والمدة المتبقية يعيد حساب القسط

### 2.2 حالات الديون + المرفقات
- إضافة `status` محسوبة لـ `person_ledger`: `active` | `overdue` | `settled` (بناءً على due_date و settled_at)
- جدول `attachments`: `entity_type` (`ledger`|`expense`|`investment`|`wallet_tx`), `entity_id`, `file_url`, `kind` (سند/عقد/حوالة/إيصال)
- Bucket تخزين `attachments` مع RLS
- رفع/معاينة مرفقات في تفاصيل كل حركة

### 2.3 تنبيهات الاستحقاق
- شريط تنبيهات موحّد في Dashboard:
  - ديون مستحقة خلال 7/30 يوم
  - ديون متأخرة
  - مصاريف دورية قادمة
- بادج رقمي على أيقونة "الأشخاص" و"الدوريات"

---

## المرحلة 3 — الاستثمارات + الزكاة الذكية

### 3.1 موديول الاستثمارات
- جدول `investments`: `name, type` (عقار/محل/مشروع/أسهم/صناديق/أخرى), `start_date, principal, ownership_pct, currency, description, is_zakatable`
- جدول `investment_transactions`: `kind` (`capital_add` | `return` | `withdraw` | `revaluation`), `amount, happened_at, wallet_id, notes`
- صفحة `/app/investments`: قائمة + KPIs (رأس المال، العوائد، الربح، ROI)
- صفحة `/app/investments/$id`: كشف عمليات + رسم بياني للعوائد عبر الزمن
- ربط بالمحفظة: عمليات `capital_add`/`return`/`withdraw` تنشئ `wallet_transactions` مقابلة

### 3.2 موديول الزكاة الذكي
- جدول `zakat_settings`: `madhhab, currency, hawl_start_date, nisab_amount, reminder_days[]`
- جدول `zakat_calculations`: snapshot تاريخي للحسابات السنوية
- صفحة `/app/zakat`:
  - يقرأ تلقائياً: أرصدة `bank` + `cash` + الديون المرجوّة + الاستثمارات المعلّمة `is_zakatable`
  - يطرح: الديون عليك (اختياري)
  - يحسب الوعاء × 2.5%
  - تنبيه قبل شهر/أسبوع/يوم الحول
  - تقرير قابل للتصدير PDF
- بطاقة في Dashboard: "الزكاة المستحقة القادمة"

---

## تحسينات UI مستمرة عبر المراحل
- نظام تصميم: gradient cards محسّنة، semantic tokens لكل نوع حركة
- جداول مع virtualization للكشوف الطويلة
- Drawer/Sheet للموبايل بدل Dialog حيث يلزم
- Empty states + Skeleton موحّدة
- نظام ألوان لكل نوع حساب (بنك أزرق، نقدي أخضر، ائتمان أحمر، استثمار بنفسجي، زكاة ذهبي)

---

## التفاصيل التقنية

**Migrations جديدة (موزّعة):**
1. توسعة `wallets` (account_type, is_archived) + `wallet_tx_categories` + بذور
2. `recurring_expenses` + `attachments` + bucket
3. `investments` + `investment_transactions` + `zakat_settings` + `zakat_calculations`

**مكتبات جديدة:**
- `jspdf` + `jspdf-autotable` + خط عربي embedded للـ PDF
- `xlsx` للتصدير لإكسل
- `recharts` (موجود غالباً) للرسوم

**ملفات جديدة رئيسية:**
- `src/lib/statement.ts` — منطق دمج التيارات وحساب الرصيد الجاري
- `src/lib/export-pdf.ts` + `src/lib/export-xlsx.ts`
- `src/components/StatementTable.tsx`
- `src/components/PersonStatementDrawer.tsx`
- `src/components/RecurringExpenseForm.tsx`
- `src/components/AttachmentUploader.tsx`
- `src/routes/_authenticated/app.recurring.tsx`
- `src/routes/_authenticated/app.investments.tsx` + `$id.tsx`
- `src/routes/_authenticated/app.zakat.tsx`

**ملاحظات:**
- لن أحذف بيانات. جدولا `debts` و `debt_payments` القديمان يبقيان كما هما (مخفيان من التنقل).
- العملات المتعددة في الكشف الموحّد: سأعرض كشفاً منفصلاً لكل عملة (لا تحويل تلقائي بدون أسعار صرف).

---

## ما أحتاج تأكيده منك قبل التنفيذ

1. **هل أبدأ بالمرحلة 1 كاملةً** الآن، أم تفضّل تجزئتها أكثر (مثلاً: 1.1+1.2+1.3 فقط أولاً، ثم كشف الشخص)؟
2. **العملات المتعددة في الكشف**: كشف منفصل لكل عملة (موصى به) أم تحويل بسعر يدوي تضعه أنت؟
3. **المرفقات (مرحلة 2)**: تخزين الملفات في Lovable Cloud Storage — موافق؟
4. **خط PDF العربي**: سأستخدم Amiri/Cairo embedded (~200KB إضافية على bundle) — موافق؟
