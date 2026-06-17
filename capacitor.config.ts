import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.rasd',
  appName: 'رصد',
  webDir: 'dist',
  // ─────────────────────────────────────────────────────────────
  // وضع التطوير (Live Reload): يحمّل التطبيق من رابط Lovable
  // قبل بناء النسخة النهائية للنشر علّق/احذف كائن server بالكامل
  // ─────────────────────────────────────────────────────────────
  server: {
    url: 'https://a152564d-27eb-4c34-88c3-bd4d16c0e912.lovableproject.com?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
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
