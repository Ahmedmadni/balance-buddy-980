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
- **production** (`CAP_ENV=production`): لا `server` block، لا cleartext، لا mixed content، لا debugging.

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

يتطلب Android SDK + JDK 17 محليًا (غير متوفر في بيئة Lovable).

## 4. التوقيع (Signing)

**لا تضع keystore أو كلمة مرور داخل Git.** أنشئه محليًا:

```bash
keytool -genkey -v -keystore rasd-release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias rasd
```

ثم `android/keystore.properties` (مُتجاهَل في `.gitignore`):

```properties
storeFile=/absolute/path/rasd-release.jks
storePassword=${ANDROID_KEYSTORE_PASSWORD}
keyAlias=rasd
keyPassword=${ANDROID_KEY_PASSWORD}
```

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
- المعرّفات الحقيقية تُدخل في `src/lib/ads/ad-config.ts` بدل الـ placeholders.
- التدقيق: `src/lib/ads/production-audit.ts` ويظهر في `/app/system`.
