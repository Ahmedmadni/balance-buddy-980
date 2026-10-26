import type { CapacitorConfig } from '@capacitor/cli';
import { validateAndroidReleaseUrl } from './src/lib/mobile/release-url';

// ─────────────────────────────────────────────────────────────
// وضعان صريحان:
//   DEVELOPMENT (افتراضي)  → Live Reload من سيرفر Lovable (sandbox)
//   PRODUCTION             → CAP_ENV=production → يحمّل النسخة المنشورة
//                            (بدون cleartext، بدون تصحيح WebView)
// التطبيق مبني على TanStack Start (SSR) ولا يُنتج index.html ثابتاً،
// لذلك يجب أن يشير server.url إلى الدومين المنشور في وضع الإنتاج.
// يمكن تجاوز الرابط عبر:  CAP_SERVER_URL=https://your-domain.com
// مثال:  CAP_ENV=production bun run android:aab
// ─────────────────────────────────────────────────────────────
const isProduction = process.env['CAP_ENV'] === 'production';
const productionUrl = process.env['CAP_SERVER_URL'] || 'https://balance-buddy-980.lovable.app';
const PROD_URL = isProduction ? validateAndroidReleaseUrl(productionUrl) : productionUrl;
const DEV_URL = 'https://a152564d-27eb-4c34-88c3-bd4d16c0e912.lovableproject.com?forceHideBadge=true';

const config: CapacitorConfig = {
  appId: 'app.lovable.rasd',
  appName: 'رصد',
  webDir: 'dist/client',
  server: isProduction
    ? { url: PROD_URL, cleartext: false, androidScheme: 'https' }
    : { url: DEV_URL, cleartext: true, androidScheme: 'https' },

  android: {
    allowMixedContent: !isProduction,
    captureInput: true,
    webContentsDebuggingEnabled: !isProduction,
    backgroundColor: '#0b1220',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0b1220',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      useDialog: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b1220',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
