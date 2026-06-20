# خطة إعادة هيكلة النظام المالي

## الملخص
إعادة تعريف النظام ليعتمد على **المعاملة المالية (Transaction)** ككيان مركزي بدلاً من الصفحات المنفصلة. هذا تغيير جوهري يمس قاعدة البيانات والمنطق والواجهات.

⚠️ هذا تعديل كبير يستغرق عدة جولات تنفيذ. أقترح تنفيذه على **4 مراحل** متتابعة، كل مرحلة قابلة للاستخدام بدون كسر ما قبلها.

---

## المرحلة 1 — توحيد المعاملات (Foundation)

### قاعدة البيانات (Migration)
إنشاء جدول موحّد `transactions` يكون المصدر الوحيد للحقيقة:

```text
transactions
├── id, user_id, created_at, updated_at
├── type            : expense | income | transfer | debt | investment
├── direction       : in | out (محسوبة من type)
├── amount, currency
├── happened_at
├── account_id      → wallets (المحفظة المتأثرة، nullable للديون فقط)
├── category_id     → unified_categories (دخل/مصروف)
├── person_id       → contacts (اختياري — لربط الشخص)
├── counterparty_account_id → wallets (للتحويلات)
├── transfer_group_id (UUID لربط طرفي التحويل)
├── source_kind, source_id (للروابط: debt/investment/recurring)
├── description, vendor, notes
├── attachment_ids[]
└── meta jsonb     (مرونة للحقول الخاصة)
```

- `unified_categories` بحقل `kind: income | expense` (دمج `categories` + `wallet_tx_categories`).
- **لا نحذف** الجداول القديمة (`expenses`, `wallet_transactions`, `person_ledger`, `debts`, `investment_transactions`). بدلاً منها:
  - **Triggers** تُرحّل كل عملية جديدة/معدلة في الجداول القديمة → `transactions` تلقائياً.
  - **Backfill** لجميع البيانات الموجودة.
  - **View** `v_account_statement` لكشف الحساب الموحّد (مع رصيد قبل/بعد).

### نتائج المرحلة 1
- جدول واحد يحوي كل العمليات.
- لا كسر للواجهات الحالية (تستمر بالعمل عبر الجداول القديمة).
- تقارير جديدة تقرأ من `transactions` فقط.

---

## المرحلة 2 — الواجهات الموحّدة

### شاشات جديدة / محدّثة
1. **`/app/transactions`** — شاشة موحّدة لكل العمليات مع فلاتر (نوع/فترة/حساب/شخص/تصنيف) وتصدير PDF/Excel.
2. **`/app/wallets/$id`** — كشف حساب تفصيلي يعرض: التاريخ | النوع | البيان | المبلغ | الرصيد قبل/بعد.
3. **نموذج موحّد `TransactionForm`** يحلّ مكان `WalletTxForm` + `PersonTxForm`:
   - تبويبات: مصروف | دخل | تحويل | دين | استثمار.
   - تحويل ذكي: عند اختيار "تحويل لشخص" → إنشاء `expense + person_ledger` بحركة واحدة.
   - تحويل كقرض → إنشاء `withdraw + person_ledger(lend)` تلقائياً.
4. **تحديث "إجراءات سريعة"** لاستخدام النموذج الموحّد.

### تصنيفات الدخل المطلوبة
راتب، أعمال حرة، استثمارات، هدايا، استرداد دين، تحويل وارد، إيرادات مشروع، أخرى. (موجود معظمها — توحيد فقط).

---

## المرحلة 3 — التقارير الجديدة

كل التقارير تُعاد كتابتها لتقرأ من `transactions`:

1. **التدفقات النقدية** — دخل/مصروف/صافي شهرياً.
2. **تقرير الحسابات** — رصيد افتتاحي + حركات + رصيد ختامي.
3. **تقرير الأشخاص** — لي/عليّ/سلف/تحويلات لكل شخص.
4. **تقرير الديون** — مستحقة لي/عليّ، متأخرات، مدفوعات.
5. **تقرير التصنيفات** — نسب الإنفاق + Pie chart.
6. **تقرير الاستثمارات** — رأس المال، القيمة، الربح، العائد %.

### تصنيف الأشخاص
إضافة حقل `kind` لـ `contacts`: فرد | زوجة | قريب | صديق | موظف | عميل | مورد.

---

## المرحلة 4 — المستشار الذكي (AI Advisor)

ربط `/app/advisor` بقاعدة البيانات عبر **server function** يستخدم Lovable AI Gateway:

```text
analyzeUserFinances(question) →
  1. يجمع آخر 90 يوم من transactions
  2. يحسب: top categories, unusual spending, recurring, liquidity forecast
  3. يحسب المؤشرات: savings rate, debt/asset, net worth, expense/income
  4. يمررها كـ context للنموذج (google/gemini-2.5-pro)
  5. يُرجع توصيات منظّمة (Output schema)
```

**أدوات (tools) للنموذج:** `get_transactions`, `get_balances`, `get_debts`, `get_investments`, `forecast_liquidity`.

**مؤشرات تُعرض دائماً:**
- معدل الادخار، نسبة المصروف/الدخل، الديون/الأصول، صافي الثروة، الرصيد المتوقع بعد 30 يوم.

---

## ما يبقى كما هو
- `wallets`, `contacts`, `investments`, `debts`, `recurring_expenses` — تبقى كجداول مرجعية.
- جداول `attachments`, `projects` — بدون تغيير.
- نظام Auth/RLS/Theme/Animations.

## الترتيب المقترح للتنفيذ
أقترح أن أبدأ **بالمرحلة 1** الآن (migration + triggers + backfill + view) لأنها الأساس. بعد التحقق من نجاحها وعدم كسر شيء، ننتقل للمرحلة 2.

**هل تريد:**
- (أ) أبدأ بالمرحلة 1 فوراً، أم
- (ب) ننفّذ الـ 4 مراحل دفعة واحدة (يستغرق وقتاً أطول وأكبر مخاطرة)، أم
- (ج) تعديلات على الخطة قبل البدء؟
