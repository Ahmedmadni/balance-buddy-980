# دليل تحويل تطبيق "رصد" إلى APK ونشره على Google Play

تم تهيئة المشروع بالكامل باستخدام **Capacitor 8** — كل الإعدادات الأساسية (اسم التطبيق، الأيقونات، شاشة البداية، شريط الحالة، الألوان) جاهزة.

---

## ✅ ما تم إعداده مسبقاً

| العنصر | القيمة |
|---|---|
| **اسم التطبيق** | رصد |
| **App ID** | `app.lovable.rasd` |
| **اللون الأساسي** | `#0b1220` (نيلي داكن) |
| **التوجه** | عمودي (Portrait) |
| **شاشة البداية** | 2.5 ثانية بخلفية داكنة وشعار مركزي |
| **شريط الحالة** | داكن مطابق للهوية |
| **أيقونة المصدر** | `resources/icon.png` (1024×1024) |
| **سبلاش المصدر** | `resources/splash.png` (2732×2732) |

---

## 📱 خطوات البناء (أول مرة فقط)

### المتطلبات
- **Node.js / Bun** + **Android Studio** (آخر إصدار) + **JDK 17+**

### 1) صدّر المشروع إلى GitHub واستنسخه محلياً
```bash
git clone <YOUR_REPO_URL>
cd <PROJECT_FOLDER>
bun install
```

### 2) أضف منصة Android
```bash
bun run android:add
```

### 3) ولّد جميع أحجام الأيقونات وشاشة البداية تلقائياً
```bash
bun run android:assets
```
سيقوم `@capacitor/assets` بتوليد كل أحجام الأيقونات (mdpi → xxxhdpi)، الأيقونة التكيّفية (Adaptive Icon)، وشاشات البداية لجميع الكثافات تلقائياً من ملفي `resources/icon.png` و `resources/splash.png`.

### 4) ابنِ التطبيق وزامن
```bash
bun run android:sync
```

### 5) افتح في Android Studio
```bash
bun run android:open
```
ثم شغّل عبر ▶️ على جهاز/محاكي.

---

## 🚀 إنشاء APK/AAB للنشر على Play Store

### 1) استخدم إعداد الإنتاج، ولا تحذف `server.url`
تطبيق رصد الحالي يعتمد على **TanStack Start SSR**؛ حذف `server.url`
سيعرض صفحة fallback محلية فقط وليس التطبيق الحقيقي.

```bash
CAP_ENV=production bun run android:prepare
CAP_ENV=production bunx cap sync android
```

راجع أن `CAP_SERVER_URL` يشير إلى موقع الإنتاج المصرح به قبل أي نشر.
ولا ترسل Google OAuth إلى WebView مضمّن داخل التطبيق.

### 2) أعد المزامنة
```bash
bun run android:sync
bun run android:open
```

### 3) عدّل رقم الإصدار في `android/app/build.gradle`
```gradle
defaultConfig {
    applicationId "app.lovable.rasd"
    versionCode 1        // ارفعه مع كل تحديث (+1)
    versionName "1.0.0"  // الإصدار الظاهر للمستخدم
}
```

### 4) في Android Studio: أنشئ AAB موقّع
- `Build → Generate Signed Bundle / APK`
- اختر **Android App Bundle (.aab)** — مطلوب من Google Play
- أنشئ **Keystore جديد** واحفظه في مكان آمن (تحتاجه لكل تحديث مستقبلي)
- اختر `release` ثم `Finish`
- الملف الناتج: `android/app/release/app-release.aab`

### 5) ارفع على Google Play Console
- أنشئ حساب مطوّر: https://play.google.com/console (رسوم 25$ لمرة واحدة)
- أنشئ تطبيقاً → ارفع `.aab`
- املأ: الوصف، لقطات الشاشة، سياسة الخصوصية، التصنيف
- أرسل للمراجعة (1-7 أيام عادةً)

---

## 🔄 التحديثات اللاحقة

```bash
# 1) عدّل versionCode و versionName في android/app/build.gradle
# 2) ابنِ وزامن
bun run android:sync
# 3) أنشئ AAB موقّع جديد بنفس الـ Keystore
```

---

## 🎨 تغيير الأيقونة أو شاشة البداية لاحقاً

1. استبدل `resources/icon.png` (1024×1024) و/أو `resources/splash.png` (2732×2732)
2. شغّل:
```bash
bun run android:assets
bun run android:sync
```

---

## 🔐 ملاحظات أمنية ومهمة

- **احفظ ملف Keystore وكلمة مروره في مكان آمن** — فقدانه يعني أنك لن تستطيع تحديث التطبيق مستقبلاً وستضطر لنشر تطبيق جديد.
- التطبيق يستخدم **Lovable Cloud** كخلفية — يعمل تلقائياً في النسخة المحمولة.
- اللغة العربية و RTL مدعومة بالكامل.
- لمزيد من التفاصيل: https://capacitorjs.com/docs/android

---

## المسارات الفعلية في 15 أكتوبر 2026
- Debug APK أصبح يُبنى عبر GitHub Actions، ويُنشر كـ workflow artifact؛ لا يتطلب تشغيل Android Studio محليًا.
- مسار Google Play الرسمي يجب أن يستخدم **AAB موقّعًا** بالمفتاح الخاص
  بالمطور (GitHub secrets محمية) بعد اكتمال فحص Google OAuth والتجربة على هاتف.
- يوجد مسار AAB يدوي، ولكن لن يُنتج ملفًا حتى يزوّد صاحب المشروع أسرار توقيع صحيحة.
- لم يكتمل بعد دعم العمل بدون اتصال؛ يظل موقع رصد المنشور مطلوبًا لعمل التطبيق.
- الخطوات التفصيلية: [دليل توقيع Android](docs/ANDROID_SIGNED_RELEASE.md).
