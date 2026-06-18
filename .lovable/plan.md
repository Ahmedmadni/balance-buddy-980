## الهدف
ربط جميع الموديولات بالمحافظ، إضافة التعديل/الحذف للعمليات من الكشوفات، وإعادة تسمية «الأشخاص» إلى «الديون»، وتفعيل كشف حساب المحافظ بشكل كامل.

## 1) ربط الموديولات بالمحافظ (Cloud / DB)

إضافة حقل `wallet_id uuid NULL REFERENCES wallets(id) ON DELETE SET NULL` على الجداول التالية إذا غير موجود:
- `person_ledger` (الديون: سلّفت/اقترضت/سددت/حصّلت)
- `investment_transactions` (إيداع/سحب رأس المال + أرباح)
- `zakat_records` (المحفظة التي خرجت منها الزكاة)
- `debt_payments` (موجود؟ — يضاف إن لم يكن)

ومنطق المزامنة (في الواجهة لا في DB لتجنب تعقيد التريغرات):
- عند إنشاء حركة في `person_ledger` مع `wallet_id`:
  - `lend` (سلّفته) → `wallet_transactions` نوع `withdraw` بنفس المبلغ.
  - `borrow` (اقترضت) → `deposit`.
  - `collect` (حصّلت) → `deposit`.
  - `pay` (سددت) → `withdraw`.
- يُحفظ `source_kind='person_ledger'` و`source_id` في `wallet_transactions` (إضافة العمودين) لتتبع المصدر ومنع التكرار عند التعديل/الحذف.
- نفس النمط للزكاة (`withdraw`) والاستثمار (deposit/withdraw حسب النوع).

تعديل `wallet_transactions`:
```sql
ALTER TABLE wallet_transactions
  ADD COLUMN source_kind text,
  ADD COLUMN source_id uuid;
CREATE INDEX ON wallet_transactions(source_kind, source_id);
```

## 2) إعادة تسمية «الأشخاص» إلى «الديون»

- استبدال نصوص الواجهة فقط: «الأشخاص» → «الديون»، وأيقونة/تسمية الـ Sidebar في `app.tsx`.
- إبقاء المسار `/app/people` كما هو (لا داعي لكسر الروابط) — أو إعادة توجيه `/app/debts` → `/app/people` (موجودة فعلاً). إعادة التسمية بصرية فقط.
- صفحة التفاصيل تبقى كشف حساب الشخص/الدين.

## 3) تفعيل كشف حساب المحافظ + التعديل والحذف

موجود بالفعل في `app.wallets.$id.tsx` عبر `StatementTable` لكن بدون أزرار تعديل. التحديثات:

### أ) إضافة عمود إجراءات في `StatementTable`
- توسيع `StatementRow` بحقول: `editable?: boolean`, `sourceTable?: 'wallet_transactions' | 'expenses' | 'person_ledger' | 'investment_transactions' | 'zakat_records'`, `sourceId?: string`.
- إضافة عمود في آخر الجدول فيه زر «تعديل» وزر «حذف» (مع تأكيد).

### ب) نموذج تعديل موحّد
- تحديث `WalletTxForm` ليقبل `initial` (لتعديل عملية محفظة قائمة) ويعمل `update` بدل `insert`.
- تحديث `ExpenseForm` و`PersonTxForm` بنفس الأسلوب.
- عند فتح زر التعديل من الكشف → فتح Dialog يحوي الفورم المناسب حسب `sourceTable`.

### ج) الحذف
- `delete` من الجدول المصدر + حذف الحركة المرتبطة في `wallet_transactions` عبر `source_kind/source_id` (إن وُجدت).

## 4) إضافة اختيار المحفظة في كل الفورمات
- `PersonTxForm`: حقل «المحفظة المتأثرة» (اختياري؛ إن لم تُحدَّد لا تنشأ حركة محفظة).
- `InvestmentTxForm` و`ZakatForm`: نفس الحقل.

## 5) عرض الكشف الموحّد للمحفظة
حالياً `buildWalletStatement` يقرأ `wallet_transactions` + `expenses` فقط. سيستفيد تلقائياً من حركات الديون/الاستثمار/الزكاة لأنها ستُكتب أيضاً في `wallet_transactions`. لكن وصف العملية سيُحسَّن:
- لو `source_kind='person_ledger'` → عرض «سداد لـ X» / «تحصيل من X» بدل «سحب/إيداع».

## ملفات ستتغير
- ترحيل DB جديد (الأعمدة الإضافية).
- `src/components/PersonTxForm.tsx`, `WalletTxForm.tsx`, نماذج الاستثمار والزكاة → دعم `initial`/تعديل + ربط المحفظة.
- `src/components/StatementTable.tsx` → عمود إجراءات.
- `src/lib/statement.ts` → تمرير `sourceTable/sourceId` + تحسين الوصف.
- `src/routes/_authenticated/app.wallets.$id.tsx` → ربط Dialogات التعديل.
- `src/routes/_authenticated/app.tsx` → تسمية «الديون».
- صفحات `app.people.tsx` و `app.people.$id.tsx` → عناوين «الديون».

## تأكيدات قبل التنفيذ
1. هل أعيد تسمية المسار من `/app/people` إلى `/app/debts` فعلياً، أم تكفي التسمية البصرية فقط؟
2. ربط الديون بالمحفظة: هل يكون **إلزامياً** عند الإنشاء، أم اختياري (لو غير محدد لا تتأثر المحفظة)؟
3. هل أبقي حركات المحفظة المرتبطة قابلة للتعديل مستقلةً، أم القفل عليها وإجبار التعديل من المصدر فقط (موصى به)؟
