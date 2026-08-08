import type { CapacitorConfig } from '@capacitor/cli';

// ─────────────────────────────────────────────────────────────
// وضعان صريحان:
//   DEVELOPMENT (افتراضي)  → Live Reload من سيرفر Lovable
//   PRODUCTION             → CAP_ENV=production (لا live reload، لا cleartext)
// مثال:  CAP_ENV=production bun run android:sync
// ─────────────────────────────────────────────────────────────
const isProduction = process.env['CAP_ENV'] === 'production';

const config: CapacitorConfig = {
  appId: 'app.lovable.rasd',
  appName: 'رصد',
  webDir: 'dist',
  ...(isProduction
    ? {}
    : {
        server: {
          url: 'https://a152564d-27eb-4c34-88c3-bd4d16c0e912.lovableproject.com?forceHideBadge=true',
          cleartext: true,
          androidScheme: 'https',
        },
      }),
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
