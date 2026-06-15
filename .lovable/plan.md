## 1) ربط الأشخاص بجهات الاتصال

- **توسيع جدول `contacts`**: إضافة عمودَي `email` و`tags` (اختياريين) لإثراء سجل الشخص.
- **إضافة `contact_id` إلى `person_ledger`**: مفتاح أجنبي اختياري إلى `contacts(id)` مع فهرس `(user_id, contact_id)`. السجلات القديمة تبقى مربوطة بالاسم.
- **ترحيل ذكي**: تشغيل تحديث لمرة واحدة يربط الحركات الموجودة بـ `contacts` المطابقة بالاسم (case-insensitive) لنفس المستخدم؛ وإن لم يوجد جهة اتصال يتم إنشاؤها تلقائياً من اسم الحركة.
- **منتقي جهات الاتصال في النموذج (`PersonTxForm`)**: استبدال حقل «اسم الشخص» النصي بـ Combobox يبحث في جهات الاتصال الموجودة مع خيار «+ إضافة جهة اتصال جديدة» داخل نفس النموذج (اسم + جوال اختياري). الحركة تُحفظ بـ `contact_id` و`contact_name` (يبقى كنسخة احتياطية للعرض السريع).
- **صفحة «الأشخاص»**: تجمع حسب `contact_id` بدل الاسم النصي، وتعرض رقم الجوال أسفل الاسم، مع زر اتصال/واتساب مباشر من البطاقة.
- **صفحة الشخص (`app.people.$id.tsx`)**: تتحوّل لتأخذ `contactId` بدل الاسم؛ يظهر فيها: الاسم، الجوال، أزرار اتصال/واتساب/SMS لتذكير الشخص بالمبلغ المستحق تلقائياً، وملاحظات جهة الاتصال، وكشف الحساب الموحّد كما هو.
- **صفحة «جهات الاتصال» (`/app/contacts`)**: CRUD كامل (إضافة/تعديل/حذف/بحث)، مع منع حذف جهة لها حركات سابقة (نعرض رسالة بدل الحذف الصامت).
- **توافق عكسي**: `debts` القديم يبقى كما هو (مع حقله `contact_id` الموجود مسبقاً). لا يُحذف شيء.

## 2) تغيير اسم التطبيق إلى «رصد»

- تحديث `<title>` في `__root.tsx` وكل `head()` في الصفحات.
- تحديث `public/manifest.webmanifest` (الاسم، short_name، الوصف).
- تحديث شعار/اسم التطبيق في `route.tsx` (الشريط العلوي والسفلي) وصفحة `auth.tsx` وصفحة الهبوط `index.tsx`.
- تحديث وصف OG/Twitter ليعكس «رصد — إدارة مالية شخصية بالعربية».

## 3) مقترحات تطوير إضافية (للاختيار)

أرشّحها بحسب الأثر:

1. **تذكيرات ذكية بالديون**: إشعارات داخل التطبيق + رسائل واتساب جاهزة عند اقتراب تاريخ الاستحقاق.
2. **تحويلات بين المحافظ**: حركة «تحويل» تخصم من محفظة وتضيف لأخرى (مع تحويل عملة اختياري).
3. **دخل وإيرادات**: إضافة جدول `incomes` مرتبط بالمحفظة ليكتمل صافي السيولة الحقيقي (دخل − مصروف).
4. **ميزانيات شهرية لكل فئة**: تنبيه عند تجاوز نسبة معينة، مع شريط تقدّم في صفحة المصروفات.
5. **تقارير ورسوم بيانية**: مخطط زمني للمصروفات، توزيع الفئات (Donut)، تطور صافي السيولة.
6. **العملات وأسعار الصرف**: عرض الصافي بعملة موحّدة باستخدام أسعار يومية (Lovable AI لجلبها).
7. **التصدير**: PDF/CSV لكشف حساب أي شخص أو تقرير شهري.
8. **نسخ احتياطي ومزامنة عبر الأجهزة**: متوفرة فعلياً عبر Lovable Cloud، فقط نوضحها للمستخدم.
9. **قفل التطبيق برقم سري/بصمة (PWA)** لحساسية البيانات المالية.
10. **وضع متعدد المستخدمين**: مشاركة مشروع/محفظة مع شخص آخر (للعائلة أو الشركاء).

أنتظر اختيارك للمقترحات قبل إدراجها في التنفيذ (أو نفّذ فقط البندَين 1 و2 الآن وأترك البقية لجولات لاحقة).

## التفاصيل التقنية

- **الترحيل**:
  ```sql
  ALTER TABLE public.contacts ADD COLUMN email text, ADD COLUMN tags text[];
  ALTER TABLE public.person_ledger ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
  CREATE INDEX person_ledger_user_contact_idx ON public.person_ledger(user_id, contact_id);
  -- backfill: ربط الحركات الموجودة وإنشاء جهات اتصال ناقصة
  INSERT INTO public.contacts (user_id, name)
    SELECT DISTINCT pl.user_id, pl.contact_name FROM public.person_ledger pl
    LEFT JOIN public.contacts c ON c.user_id=pl.user_id AND lower(c.name)=lower(pl.contact_name)
    WHERE pl.contact_id IS NULL AND c.id IS NULL;
  UPDATE public.person_ledger pl SET contact_id=c.id
    FROM public.contacts c WHERE c.user_id=pl.user_id AND lower(c.name)=lower(pl.contact_name) AND pl.contact_id IS NULL;
  ```
- **التوجيه**: `app.people.$name.tsx` → `app.people.$id.tsx` + إنشاء `app.contacts.tsx`.
- **منتقي**: مكوّن `ContactPicker` يعتمد على `Command` من shadcn.
- **الواتساب**: رابط `https://wa.me/<phone>?text=<encoded>` مع رسالة افتراضية مولّدة من الرصيد الحالي.