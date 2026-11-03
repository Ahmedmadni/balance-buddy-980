# Android Release — رصد (Rasd)

> حالة التحقق في 3 نوفمبر 2026: نجح بناء APK تجريبي على GitHub؛ يُولّد مجلد
> `android/` داخل بيئة البناء. إصدار APK/AAB الإنتاجي الموقّع لم يُبنَ بعد لأن أسرار التوقيع غير مضافة.

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
نجح التشغيل الأخير في 2 نوفمبر 2026 بعد إصلاح إعداد SDK.
رابط التشغيل المتحقق منه: https://github.com/Ahmedmadni/balance-buddy-980/actions/runs/41420922221
هذه نسخة debug للاختبار، وليست إصدار متجر إنتاجيًا؛ تجربة جهاز فعلي ما زالت مطلوبة.
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

وفي مسار GitHub الحالي استخدم أسرارًا: `ANDROID_KEYSTORE_BASE64` · `ANDROID_KEYSTORE_PASSWORD` ·
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

## Signed release via GitHub Actions (`android-release.yml`)

Manual workflow that builds a **signed** release APK and AAB and uploads them as GitHub Actions artifacts requiring repository download access. It never publishes to Google Play. Artifacts are not a private storage vault; never upload signing files or passwords.

Required repository secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Content |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | The `.jks` keystore encoded with `base64 -w0 release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |

Run: Actions → "Android signed release (APK + AAB)" → Run workflow, with an increasing `version_code` and a `version_name`. The keystore is decoded only into the runner temp dir and deleted after the build. Keep an offline backup of the keystore: losing it blocks future updates of the same app.

### متابعة الإصدار الموقّع — 3 نوفمبر 2026

- تم التحقق عبر اتصال **Ahmed's GitHub API** من أن المسار موجود ومفعّل، وأن قائمة أسرار المستودع فارغة؛ لا يمكن بناء إصدار موقّع قبل إضافتها.
- أضف الأسرار الأربعة أعلاه مباشرة في [إعدادات أسرار GitHub](https://github.com/Ahmedmadni/balance-buddy-980/settings/secrets/actions). لا ترسل ملف المفتاح أو كلمات المرور في المحادثة.
- `version_code` عدد صحيح من 1 إلى 2100000000؛ استخدم رقمًا أكبر من آخر إصدار موزّع. `version_name` من 1 إلى 64 محرفًا من الحروف الإنجليزية والأرقام و`. _ + -`.
- المسار يرفض بيانات إصدار غير آمنة، ويتحقق من توقيع APK وAAB وتطابق شهادة توقيعهما، ثم يُخرج الملفين وبصماتهما SHA-256 لمدة 30 يومًا.
- التحقق الكامل لتوقيع الإنتاج مؤجل إلى حين إضافة الأسرار وتشغيل المسار. لم يُنشر أي شيء على Google Play، ولم يتغير المنطق المالي.
