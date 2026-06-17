# دليل تحويل تطبيق "رصد" إلى APK ونشره على Google Play

تم تهيئة المشروع باستخدام **Capacitor** لتحويل تطبيق الويب إلى تطبيق Android أصلي.

## المتطلبات الأساسية

- **Node.js / Bun** مثبت
- **Android Studio** (آخر إصدار) — لبناء APK/AAB والتوقيع
- **JDK 17+** (يأتي مع Android Studio)
- **Git** لاستنساخ المشروع

---

## الخطوات الكاملة (أول مرة)

### 1) استنساخ المشروع محلياً
```bash
git clone <YOUR_REPO_URL>
cd <PROJECT_FOLDER>
bun install
```

### 2) إضافة منصة Android
```bash
npx cap add android
npx cap update android
```
سيتم إنشاء مجلد `android/` (لا تعدل ملفاته يدوياً إلا للأيقونات والتوقيع).

### 3) البناء والمزامنة
```bash
bun run build
npx cap sync android
```

### 4) الفتح في Android Studio
```bash
npx cap open android
```
- اترك Gradle ينهي المزامنة.
- شغّل التطبيق على جهاز/محاكي عبر زر ▶️.

---

## وضع التطوير (Live Reload)

ملف `capacitor.config.ts` يحتوي على كائن `server.url` يحمّل التطبيق مباشرة من رابط Lovable المنشور.
- أي تعديل تنشره من Lovable يظهر فوراً في تطبيق Android دون إعادة بناء.
- مفيد جداً للاختبار السريع.

---

## وضع الإنتاج (للنشر على Play Store)

قبل إنشاء ملف AAB/APK للمتجر:

### 1) عطّل Live Reload
في `capacitor.config.ts` **علّق أو احذف** كائن `server` بالكامل:
```ts
// server: { url: '...', cleartext: true },
```

### 2) ابنِ نسخة ثابتة
```bash
bun run build
npx cap sync android
npx cap open android
```

### 3) إنشاء AAB موقّع (في Android Studio)
- `Build → Generate Signed Bundle / APK`
- اختر **Android App Bundle (.aab)** — مطلوب من Google Play
- أنشئ **Keystore جديد** (احفظه في مكان آمن — ستحتاجه لكل تحديث)
- اختر `release` ثم `Finish`
- ستجد الملف في: `android/app/release/app-release.aab`

### 4) رفع على Google Play Console
- أنشئ حساب مطوّر (رسوم 25$ لمرة واحدة): https://play.google.com/console
- أنشئ تطبيقاً جديداً → ارفع ملف `.aab`
- املأ بيانات التطبيق (الوصف، الأيقونة، لقطات الشاشة، سياسة الخصوصية)
- ابدأ المراجعة (تستغرق عادة 1-7 أيام)

---

## الأيقونات وشاشة البداية

ضع الأيقونات في `android/app/src/main/res/` بالأحجام التالية (Android Studio → Image Asset):
- `mipmap-mdpi`: 48x48
- `mipmap-hdpi`: 72x72
- `mipmap-xhdpi`: 96x96
- `mipmap-xxhdpi`: 144x144
- `mipmap-xxxhdpi`: 192x192

أو استخدم أدوات مثل: https://icon.kitchen أو https://www.appicon.co

---

## تحديثات لاحقة

بعد أي تعديل في الكود:
```bash
bun run build
npx cap sync android
```
ثم أعد البناء في Android Studio (Build → Generate Signed Bundle).

⚠ **مهم**: عند نشر تحديث، ارفع `versionCode` و `versionName` في `android/app/build.gradle` قبل البناء.

---

## ملاحظات

- التطبيق يستخدم **Lovable Cloud (Supabase)** كخلفية — يعمل تلقائياً في النسخة المحمولة.
- اللغة العربية و RTL مدعومة.
- إذا واجهت مشاكل، راجع: https://capacitorjs.com/docs/android
