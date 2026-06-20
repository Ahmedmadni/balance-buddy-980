## الهدف

محاذاة لوحة التحكم في الويب مع التطبيق (الصور المرفقة): إضافة شريط "إجراءات سريعة" + شريط "الأدوات" مع انتقالات سلسة، وتحسينات بصرية صغيرة مطابقة للصور.

## التغييرات

### 1) قسم "إجراءات سريعة" (في `app.index.tsx` فوق رسم التدفقات)

بطاقات أيقونية مربعة (rounded-2xl) قابلة للتمرير أفقياً على الجوال، شبكة 3-6 أعمدة على الديسكتوب:

- **مصروف** (أحمر، أيقونة TrendingDown) → يفتح Drawer جديد لإضافة مصروف سريع
- **دخل** (أخضر، TrendingUp) → wallet tx kind=deposit
- **تحويل** (أزرق، ArrowLeftRight) → wallet tx kind=transfer
- **دين/تحصيل** (برتقالي، Users) → person tx (lend/repay)
- **استثمار** (بنفسجي، PieChart) → /app/investments
- **الزكاة** (أخضر فاتح، Percent) → /app/zakat

كل بطاقة: أيقونة داخل مربع ملوّن شفاف + اسم تحت الأيقونة، تأثير `hover:-translate-y-0.5` + `whileTap scale 0.95` بـ Framer Motion.

### 2) قسم "الأدوات" (تحته مباشرة)

نفس الشكل، روابط مباشرة (Link prefetch):

- **دورية** → /app/recurring
- **الدخل** (تقارير الدخل) → /app/reports?tab=income
- **المستشار** (جديد placeholder) → /app/reports
- **الاستثمارات** → /app/investments
- **التقارير** → /app/reports
- **الإعدادات** → /app/settings

### 3) مكوّن جديد `QuickActionCard`

`src/components/dashboard/QuickActionCard.tsx` — يستقبل `icon, label, color, onClick|to`، يطبّق tokens من `styles.css` (لا ألوان مباشرة) — accent عبر `bg-{tone}/10 text-{tone}` مع 6 toneات معرّفة.

### 4) Drawers سريعة

`src/components/QuickExpenseSheet.tsx` و `src/components/QuickIncomeSheet.tsx` — نماذج مبسطة (مبلغ + محفظة + ملاحظة) تستخدم نفس `WalletTxForm`/expenses logic مع Zod، وعند الحفظ: invalidate `["dashboard"]` + toast.

### 5) انتقالات سريعة

- إضافة `preload="intent"` على روابط Link
- `PageTransition` خفيف عبر AnimatePresence في `_authenticated/route.tsx` (fade+y=4، 180ms)
- StaggerGrid على شبكة الإجراءات

### 6) تحسينات بصرية مطابقة للصور

- بطاقة "إجمالي السيولة" تأخذ عرضاً كاملاً بخلفية primary gradient ومدمج فيها شارتا "دخل/صرف" صغيرتان (Pill شفافة) — كما في الصورة الأولى
- باقي KPIs (مستحق لي/علي، أرباح، استثمارات) في شبكة 2×2 تحتها
- زيادة `rounded` للبطاقات إلى `rounded-3xl` وتقليل padding على الجوال

## الملفات

- تعديل: `src/routes/_authenticated/app.index.tsx`, `src/routes/_authenticated/route.tsx`
- جديد: `src/components/dashboard/QuickActionCard.tsx`, `src/components/dashboard/QuickActionsRow.tsx`, `src/components/QuickExpenseSheet.tsx`, `src/components/QuickIncomeSheet.tsx`, `src/components/motion/PageTransition.tsx`

## خارج النطاق

- لا تغييرات على قاعدة البيانات أو RLS
- لا تعديل على موديولات أخرى غير لوحة التحكم
- تفعيل الوضع النهاري