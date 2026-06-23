# خطة توحيد الأصول والاستثمارات في منصة رصد

## الفكرة المحورية
دمج جدول `investments` الحالي ليصبح كياناً موحداً باسم **Asset** يستوعب كل أنواع الممتلكات (سيارات، عقارات، ذهب، أسهم، استثمارات) مع محرك حركات مالية مصنّف (CapEx / OpEx / Income / Adjustment) مرتبط مباشرة بالمحافظ، التقارير، والزكاة.

---

## المرحلة 1 — قاعدة البيانات (هجرة واحدة)

### 1.1 توسيع جدول `investments` ليصبح وعاء الأصول الموحّد
- `asset_kind`: `car | real_estate | gold | stocks | crypto | fund | custom` (يحلّ محل `type` المستخدم حالياً مع توافق رجعي).
- `purpose`: موجود — يبقى كما هو (`personal_use | rental | trade | investment | resale | …`).
- `base_value`: تكلفة الشراء الأصلية.
- `capex_total`, `opex_total`, `income_total`: حقول محسوبة (أو تُحسب لحظياً من المعاملات).
- `current_value`: القيمة السوقية الحالية (يحدّثها المستخدم).
- `status`: `active | sold | archived`.
- `sold_at`, `sold_amount`, `realized_pnl`.
- `primary_wallet_id`: المحفظة الأساسية المرتبطة.

### 1.2 توسيع جدول `investment_transactions` بنوع موحّد
- إضافة عمود `tx_class`: `capex | opex | income | adjustment | personal_benefit | sale`.
- إبقاء `kind` الحالي للتوافق.
- `category_id` (اختياري لربط OpEx بفئة مصروف).
- `affects_wallet`: bool (افتراضي true ما عدا personal_benefit).

### 1.3 التريغرات الموجودة
`_sync_tx_from_investment_tx` يستمر بمزامنة `transactions` (التقارير). نضيف منطق: لو `tx_class = opex` يُسجَّل `type = expense` بدلاً من `investment` ليظهر في تقارير المصاريف الشهرية.

---

## المرحلة 2 — منطق الحساب (lib)

ملف جديد `src/lib/assets/calculator.ts`:
- `computeAssetMetrics(asset, txs)` → `{ baseValue, capex, opex, income, netCashflow, bookValue, marketValue, pnl }`
- معادلة القيمة الدفترية: `base + capex - depreciation`
- صافي التدفقات: `income - opex - capex`
- ربح/خسارة محققة عند البيع.

---

## المرحلة 3 — واجهة المستخدم

### 3.1 إعادة تسمية صفحة `/app/investments` إلى **"الأصول والاستثمارات"** (نفس المسار)
- نموذج إضافة أصل موحّد: النوع → الغرض → المحفظة الأساسية → القيمة الأساسية → تاريخ التملك.
- حقول ديناميكية حسب النوع (موجودة جزئياً): سيارة (موديل، لوحة)، عقار (مساحة، موقع)، ذهب (عيار، وزن)، أسهم (رمز، كمية).

### 3.2 لوحة تحكم الأصل `/app/investments/$id` (جديد)
- بطاقات: القيمة الحالية، CapEx، OpEx، الإيرادات، صافي التدفق، الربح/الخسارة.
- جدول الحركات المالية مع فلتر حسب النوع.
- 4 أزرار سريعة:
  - **+ مصروف رأسمالي** (CapEx)
  - **+ مصروف تشغيلي** (OpEx)
  - **+ دخل / إيراد** (Income)
  - **⚙ تعديل قيمة** (Adjustment)
- أزرار حالة: **بيع الأصل** / **أرشفة** / **إيقاف التتبع**.

### 3.3 نموذج الحركة الموحّد `AssetTxForm`
حقل `tx_class` كـ Toggle (CapEx/OpEx/Income/Adjustment) يُغيّر:
- الاتجاه (دخل/خرج من المحفظة).
- التصنيف المحاسبي.
- ظهور حقل فئة المصروف (للـ OpEx فقط).

### 3.4 تكامل مع المصاريف الشهرية
في `/app/expenses`: تظهر مصاريف OpEx المرتبطة بأصول مع شارة "🏷 من أصل: …" وفلتر "عرض مصاريف الأصول".

### 3.5 تكامل مع التقارير
`/app/reports`: قسم جديد **"أداء الأصول"** يعرض: إجمالي قيمة الأصول، صافي الربح/الخسارة، أعلى الأصول إنتاجية.

---

## المرحلة 4 — التكامل مع الزكاة

تحديث `classifyAsset` في `src/lib/zakat/engine.ts`:
- استخدام `asset_kind + purpose` لتحديد `is_zakatable`.
- استخدام `current_value` (وليس base) للقيمة السوقية في الوعاء.
- السيارات: `personal_use` → غير زكوية، `trade/rental` → زكوية بالقيمة السوقية.
- العقارات: نفس المنطق الموجود.
- يبقى نظام الزكاة الذكي كما هو دون كسر.

---

## المرحلة 5 — ما لن يتأثر
- المحافظ، الديون، الاشتراكات المتكررة، المشاريع.
- صلاحيات RLS.
- نظام الزكاة الذكي (يستفيد فقط من بيانات أدق).
- التريغرات الموجودة للمزامنة مع `transactions`.

---

## الملفات المتوقعة
- هجرة DB واحدة (`add_asset_unification`)
- `src/lib/assets/calculator.ts` (جديد)
- `src/components/AssetForm.tsx` (إعادة هيكلة من `InvestmentForm`)
- `src/components/AssetTxForm.tsx` (جديد — يستبدل النموذج الحالي)
- `src/routes/_authenticated/app.investments.tsx` (إعادة تصميم القائمة)
- `src/routes/_authenticated/app.investments.$id.tsx` (جديد — لوحة تحكم الأصل)
- `src/routes/_authenticated/app.expenses.tsx` (شارة + فلتر)
- `src/routes/_authenticated/app.reports.tsx` (قسم أداء الأصول)
- `src/lib/zakat/engine.ts` (تحديث `classifyAsset`)

---

## ترتيب التنفيذ
1. هجرة DB (تتطلب موافقة).
2. بعد الموافقة: lib + النماذج + الصفحات.
3. اختبار: إضافة سيارة + قطع غيار + تأمين + إيجار → التحقق من القيم في لوحة الأصل والمصاريف والمحفظة.

هل أبدأ بإرسال الهجرة؟
