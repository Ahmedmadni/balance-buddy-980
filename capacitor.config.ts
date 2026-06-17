import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a152564d27eb4c3488c3bd4d16c0e912',
  appName: 'رصد',
  webDir: 'dist',
  // أثناء التطوير: حمّل التطبيق من رابط Lovable المنشور (Live Reload)
  // قبل البناء النهائي للنشر على المتجر: علّق هذا الكائن server بالكامل
  // ثم نفّذ: bun run build && npx cap sync android
  server: {
    url: 'https://a152564d-27eb-4c34-88c3-bd4d16c0e912.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0b1220',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b1220',
    },
  },
};

export default config;
