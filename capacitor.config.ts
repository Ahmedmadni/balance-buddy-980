import type {CapacitorConfig} from "@capacitor/cli";
// Only this native feature branch uses packaged offline HTML. The public web
// app is still TanStack Start + Supabase (built with bun run build).
const devUrl="https://a152564d-27eb-4c34-88c3-bd4d16c0e912.lovableproject.com?forceHideBadge=true";
const production=process.env.CAP_ENV==="production";
const config:CapacitorConfig={
  appId:"app.lovable.rasd",appName:"رصد",webDir:"dist/client",
  // No server.url in production: Android launches its embedded local app.
  ...(production?{}:{server:{url:devUrl,cleartext:true,androidScheme:"https"}}),
  android:{
    allowMixedContent:!production,
    captureInput:true,
    webContentsDebuggingEnabled:!production,
    backgroundColor:"#0b1220",
  },
  plugins:{
    SplashScreen:{launchShowDuration:1000,launchAutoHide:true,backgroundColor:"#0b1220"},
    StatusBar:{style:"DARK",backgroundColor:"#0b1220",overlaysWebView:false},
    Keyboard:{resize:"body",resizeOnFullScreen:true},
  },
};
export default config;
