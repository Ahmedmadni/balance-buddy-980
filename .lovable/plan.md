# خطة التحسين الشاملة — رصد

## 1) نظام التصميم (Design Tokens)

تحديث `src/styles.css` لتطبيق هوية "البنكي الفاخر":
- خط `IBM Plex Sans Arabic` بدل Cairo (مع Cairo كاحتياط) — إضافة `<link>` في `__root.tsx`.
- لوحة ألوان مكررة بالضبط من النموذج: `slate/zinc` للخلفيات و `teal-600` للأساسي، `emerald`/`rose` للحالات الإيجابية/السلبية.
- **زوايا أكثر استدارة**: `--radius: 1rem` و `rounded-2xl`/`rounded-3xl` للبطاقات الكبرى.
- **ظلال ناعمة**: `shadow-card`, `shadow-elegant` معاد ضبطها لتطابق `shadow-2xl shadow-slate-200/50`.
- مفتاح تبديل الوضع الداكن في الـ Sidebar السفلي (يحفظ في `localStorage`).

## 2) Sidebar والـ Layout الرئيسي

- إعادة تصميم `src/routes/_authenticated/route.tsx`:
  - شعار `رصد` بمربع teal-600 مستدير بدل التصميم الحالي.
  - عناصر القائمة بأيقونات Lucide نظيفة، حالة active بـ `bg-teal-50 text-teal-700`.
  - فاصل علوي قبل "الإعدادات" + زر تبديل الوضع الداكن + بطاقة المستخدم.
- Header موحد في كل صفحة: عنوان كبير + وصف صغير + أزرار إجراءات يمين.

## 3) لوحة التحكم (`app.index.tsx`)

- 4 بطاقات KPI بالتصميم الجديد + شارة `+%` للسيولة (مقارنة الشهر الماضي).
- لوحة "التدفق النقدي 14 يوم" بأعمدة Recharts ملونة (teal فاتح للإيرادات، slate للمصروفات).
- بطاقة "المحافظ" بنقاط ملونة + زر "إضافة محفظة" متقطع الإطار.
- بطاقة "توزيع المصاريف" أفقية: قائمة فئات بنسب وأشرطة تقدم على اليمين، Donut Chart كبير على اليسار مع إجمالي في الوسط.

## 4) باقي الصفحات (تطبيق نفس اللغة البصرية)

- **المحافظ، المصاريف، الديون، الاستثمارات، الزكاة، التقارير، جهات الاتصال، الإعدادات**:
  - كل البطاقات → `rounded-2xl/3xl`, `border border-slate-100 dark:border-zinc-800`, `shadow-sm`.
  - الجداول → خلفية بيضاء، حدود خفيفة، صفوف بـ `hover:bg-slate-50`.
  - الأزرار الأساسية → teal-600، الثانوية → outline.
  - النماذج (Dialogs/Drawers) → نفس نظام الحواف والظلال.

## 5) الحركات (Framer Motion)

تثبيت `framer-motion` ثم إنشاء helpers:
- `src/components/motion/FadeIn.tsx`, `StaggerGrid.tsx`, `Counter.tsx` (عدّاد رقمي يصعد عند التحميل).
- تطبيق:
  - دخول مرحلي (stagger) لبطاقات KPI ولصفوف القوائم.
  - `hover:-translate-y-1` على البطاقات + transition ناعم.
  - عدّاد رقمي على أرقام السيولة والمستحقات.
  - انتقالات صفحات `AnimatePresence` على Outlet (اختياري وخفيف).

## 6) تدقيق الأمان الاحترافي

### 6.1 فحوصات تلقائية
- `security--run_security_scan` + `supabase--linter` ومعالجة كل ملاحظة.
- تفعيل **HIBP** (Have I Been Pwned) لكلمات المرور عبر `supabase--configure_auth`.

### 6.2 مراجعة RLS والـ GRANTs
- مراجعة جميع 17 جدول للتأكد من:
  - `ENABLE ROW LEVEL SECURITY` مفعّل.
  - السياسات مقيدة بـ `auth.uid() = user_id`.
  - وجود `GRANT` صحيح لـ `authenticated` و `service_role` فقط (لا `anon`).
- إصلاح أي قصور عبر migration واحدة موحدة.

### 6.3 التحقق من المدخلات (Zod)
- إنشاء `src/lib/schemas.ts` بمخططات Zod لكل النماذج: محافظ، مصاريف، ديون، اشخاص، استثمارات، زكاة.
- استخدامها في جميع `*Form.tsx` لمنع البيانات السيئة قبل الإرسال.
- حدود أطوال صارمة لكل الحقول النصية.

### 6.4 تنظيف الكود
- إزالة أي `console.log` يكشف بيانات حساسة.
- التأكد من عدم استخدام `dangerouslySetInnerHTML` على محتوى مستخدم.
- مراجعة `src/lib/wallet-sync.ts` و `statement.ts` للتأكد من التحقق من ملكية المستخدم.

### 6.5 تحديث ذاكرة الأمان
- `security--update_memory` بملخص الوضع الأمني الجديد ونموذج التحكم في الوصول.

## التفاصيل التقنية

**ملفات جديدة:**
- `src/components/motion/{FadeIn,StaggerGrid,Counter,PageTransition}.tsx`
- `src/components/ThemeToggle.tsx`
- `src/lib/schemas.ts`
- `src/hooks/use-theme.ts`

**ملفات معدّلة:**
- `src/styles.css` — tokens جديدة + خط جديد
- `src/routes/__root.tsx` — `<link>` الخط + ThemeProvider
- `src/routes/_authenticated/route.tsx` — Sidebar الجديد
- `src/routes/_authenticated/app.index.tsx` — لوحة التحكم الجديدة
- باقي صفحات `_authenticated/app.*.tsx` — تطبيق التصميم
- `src/components/{WalletTxForm,PersonTxForm,*Form}.tsx` — إضافة Zod
- جميع `Card`/`Button`/`Dialog` shadcn variants حسب الحاجة

**Migration واحدة:** `tighten_rls_and_grants` لإصلاح أي ثغرات.

**حزم جديدة:** `framer-motion`, `zod` (مثبت غالباً).

## النتيجة المتوقعة

- واجهة بنكية فاخرة بنفس النموذج المختار + وضع داكن كامل.
- حركات احترافية ناعمة على كل التفاعلات الرئيسية.
- درجة أمان مرتفعة: RLS محكم، HIBP مفعل، Zod على كل المدخلات، صفر تحذيرات من linter.
