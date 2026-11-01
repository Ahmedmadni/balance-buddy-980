# Android Release — رصد (Rasd)

> حالة اليوم: **لا يوجد مجلد `android/` في المستودع** — لم تُضف منصّة Capacitor بعد،
> وبالتالي **لم يُبنَ أي APK أو AAB**. هذا الملف هو مسار التنفيذ الفعلي.

## 1. الهوية والإصدار (Source of truth)

| القيمة | المكان | الحالي |
| --- | --- | --- |
| `applicationId` | `capacitor.config.ts` → `appId` | `app.lovable.rasd` |
| `versionName` | `package.json` → `version` | راجع الملف |
| `versionCode` | `src/lib/release/metadata-config.ts` → `BUILD_NUMBER` | `1` |

بعد `cap add android` انقل هذه القيم إلى `android/app/build.gradle`
(`versionCode` / `versionName`) وحدّثها مع كل رفعة للمتجر.

## 2. وضعا التشغيل

`capacitor.config.ts` يقرأ `CAP_ENV`:

- **development** (افتراضي): Live Reload من رابط Lovable، `allowMixedContent: true`، تصحيح WebView مفعّل.
- **production** (`CAP_ENV=production`): يحمّل الدومين المنشور (`https://balance-buddy-980.lovable.app` أو `CAP_SERVER_URL`)، بدون cleartext، بدون mixed content، بدون debugging.

> ملاحظة مهمة: التطبيق مبني على TanStack Start (SSR) ولا يُنتج ملف `index.html` ثابتاً،
> لذا لا يمكن حزم الواجهة داخل الـ APK بالكامل — يجب أن يشير `server.url` في الإنتاج
> إلى نسخة منشورة فعلياً (انشر التطبيق أولاً من زر Publish).


## 3. الأوامر

```bash
bun run android:add          # مرة واحدة — ينشئ android/
bun run android:assets       # أيقونات/سبلاش من resources/
bun run android:sync         # تطوير
bun run android:sync:prod    # إنتاج (CAP_ENV=production)
bun run android:debug        # Debug APK  → android/app/build/outputs/apk/debug/
bun run android:apk          # Release APK → android/app/build/outputs/apk/release/
bun run android:aab          # Release AAB → android/app/build/outputs/bundle/release/
```

يتطلب Android SDK + JDK 21 لـ Capacitor 8 محليًا (غير متوفر في بيئة Lovable).

### بناء APK اختباري من GitHub

أُضيف مسار يدوي `Android hosted debug package` في Actions. يتحقق المسار من إتاحة
رابط التطبيق المنشور؛ لا يحتاج متغيرات اتصال قاعدة البيانات لأن الحزمة عميل HTTPS مستضاف.
يختبر الاعتمادات ويفحص أمانها، ويولّد مشروع Android داخل بيئة البناء فقط، ثم APK debug
وملف SHA-256 ضمن artifact يحتفظ به 14 يومًا. لا يوقّع إصدار متجر ولا يرفع إلى Google Play.
شُغّل المسار في 1 نوفمبر 2026، لكنه توقف أثناء إعداد Android SDK لأن حزمة `tools`
القديمة لم تعد متاحة. عُدّل الإعداد إلى `platform-tools` وثُبّت Ubuntu 24.04 وJDK 21.
يلزم تشغيله مجددًا بعد وصول التعديلات إلى GitHub؛ لا يوجد ملف تحميل لهذا التشغيل الفاشل.
نجاحه وتثبيت APK على جهاز شرط قبل اعتماد الجاهزية.
ملف index.html المؤقت في مخرجات البناء هو bootstrap فقط؛ التشغيل يبقى عبر HTTPS المستضاف.

بعد نجاح التشغيل، افتح صفحة التشغيل في GitHub Actions ثم قسم **Artifacts** واختر
`rasd-hosted-debug-apk` لتحميل الأرشيف الذي يحتوي `app-debug.apk` وSHA-256.
لا تعرض صفحة تشغيل فاشلة كرابط تنزيل APK، ولا تسمِّ حزمة debug إصدار متجر نهائيًا.

## حالة التحقق — 1 نوفمبر 2026

- نجح 97 اختبارًا محليًا؛ نجح فحص البناء التلقائي بعد تحديث الاعتمادات.
- أُصلح فشل فحص اعتماد الإنتاج: Seroval 1.7.5 وVite 8.3.5 وZod 4.6.7.
- فحص `npm audit --omit=dev` الحالي: صفر ثغرات. فحص الاعتمادات التطويرية الكامل ما زال
  يسجل ثغرات انتقالية ويحتاج مراجعة منفصلة؛ لا تُعلن خلو المشروع كله من الثغرات.
- تحقق الدخول إلى `/app` بجلسة موجودة، ورفض ملف Backup v2 غير صالح، وعرض تأكيد الاستعادة
  وإلغائه دون إرسال أي طلب استعادة؛ لم تُجرَ استعادة حقيقية.
- لم يُختبر تسجيل Google التفاعلي على هاتف، ولم يُنتج إصدار APK/AAB موقّع في هذه الجلسة.
- Google Drive غير مرتبط؛ يحتاج موافقة كل مستخدم للوصول إلى حسابه وتنفيذ إدارة نسخ فعلية.
  لا تستخدم حساب مالك المشروع أو موصلًا مشتركًا لحفظ نسخ المستخدمين المالية.
- التوقيع الإنتاجي ومعرّفات AdMob الحقيقية وتجربة جهاز فعلي شروط خارجية ما زالت مفتوحة.

## 4. التوقيع (Signing)

**لا تضع keystore أو كلمة مرور داخل Git.** أنشئه محليًا:

```bash
keytool -genkey -v -keystore rasd-release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias rasd
```

ثم `android/keystore.properties` (مُتجاهَل في `.gitignore`):

```properties
storeFile=/absolute/path/rasd-release.jks
storePassword=<local-keystore-password>
keyAlias=rasd
keyPassword=<local-key-password>
```

ملف Properties لا يوسّع `${ENV_VAR}` تلقائيًا. القيم أعلاه محلية فقط ولا تُرفع إلى Git؛
في CI اقرأ الأسرار مباشرةً عبر `System.getenv` في إعداد Gradle.

وفي CI استخدم أسرارًا: `ANDROID_KEYSTORE_PATH` · `ANDROID_KEYSTORE_PASSWORD` ·
`ANDROID_KEY_ALIAS` · `ANDROID_KEY_PASSWORD`.

`android/app/build.gradle` (بعد إنشاء المنصّة):

```gradle
def props = new Properties()
def f = rootProject.file("keystore.properties")
if (f.exists()) props.load(new FileInputStream(f))

android {
  signingConfigs {
    release {
      if (f.exists()) {
        storeFile file(props['storeFile']); storePassword props['storePassword']
        keyAlias props['keyAlias']; keyPassword props['keyPassword']
      }
    }
  }
  buildTypes { release { signingConfig signingConfigs.release; minifyEnabled true } }
}
```

## 5. AdMob

- لا يوجد SDK إعلانات مثبّت حاليًا (`AdProviderRoot` يستخدم `NoopAdProvider`).
- قبل التفعيل: أضف `ca-app-pub-…~…` في `AndroidManifest.xml` وحزمة AdMob لـ Capacitor.
- في التطوير استخدم معرّفات Google الاختبارية فقط (`TEST_IDS` في `src/lib/ads/ad-config.ts`).
- المعرّفات العامة الحقيقية تُدخل كمتغيرات `VITE_ADMOB_ANDROID_APP_ID` و`VITE_ADMOB_ANDROID_BANNER_ID` و`VITE_ADMOB_ANDROID_INTERSTITIAL_ID`، مع `VITE_ADS_MODE=production`؛ لا حاجة لكتابة مفاتيح خاصة.
- التدقيق: `src/lib/ads/production-audit.ts` ويظهر في `/app/system`.
