// =============================================================
// Ad Engine — Central Configuration
// -------------------------------------------------------------
// IMPORTANT: This file contains PLACEHOLDERS ONLY.
// No real ads, no SDK, no external script is loaded at runtime.
// Replace the placeholder IDs with real ones when ready to monetize.
// =============================================================

export type AdPlatform = "web" | "android" | "ios" | "premium" | "auto";

export type AdPlacement =
  | "dashboard_top"
  | "dashboard_bottom"
  | "transactions_inline"
  | "reports_bottom"
  | "settings_banner"
  | "assets_list_bottom"
  | "asset_details_bottom"
  | "people_bottom"
  | "zakat_bottom";

export type AdFormat = "banner" | "rectangle" | "interstitial" | "reward" | "native";

// ----- Web (Google AdSense placeholders) -----
export const WEB_ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX"; // TODO
export const WEB_ADSENSE_SLOTS: Record<AdPlacement, string> = {
  dashboard_top: "0000000001",
  dashboard_bottom: "0000000002",
  transactions_inline: "0000000003",
  reports_bottom: "0000000004",
  settings_banner: "0000000005",
  assets_list_bottom: "0000000006",
  asset_details_bottom: "0000000007",
  people_bottom: "0000000008",
  zakat_bottom: "0000000009",
};

// ----- Android (Google AdMob placeholders) -----
export const ANDROID_ADMOB_APP = "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"; // TODO
export const ANDROID_ADMOB_UNITS: Record<AdPlacement, string> = {
  dashboard_top: "ca-app-pub-XXX/AND_TOP",
  dashboard_bottom: "ca-app-pub-XXX/AND_BOTTOM",
  transactions_inline: "ca-app-pub-XXX/AND_TX_INLINE",
  reports_bottom: "ca-app-pub-XXX/AND_REPORTS",
  settings_banner: "ca-app-pub-XXX/AND_SETTINGS",
  assets_list_bottom: "ca-app-pub-XXX/AND_ASSETS",
  asset_details_bottom: "ca-app-pub-XXX/AND_ASSET_DETAIL",
  people_bottom: "ca-app-pub-XXX/AND_PEOPLE",
  zakat_bottom: "ca-app-pub-XXX/AND_ZAKAT",
};

// ----- iOS (Google AdMob placeholders) -----
export const IOS_ADMOB_APP = "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"; // TODO
export const IOS_ADMOB_UNITS: Record<AdPlacement, string> = {
  dashboard_top: "ca-app-pub-XXX/IOS_TOP",
  dashboard_bottom: "ca-app-pub-XXX/IOS_BOTTOM",
  transactions_inline: "ca-app-pub-XXX/IOS_TX_INLINE",
  reports_bottom: "ca-app-pub-XXX/IOS_REPORTS",
  settings_banner: "ca-app-pub-XXX/IOS_SETTINGS",
  assets_list_bottom: "ca-app-pub-XXX/IOS_ASSETS",
  asset_details_bottom: "ca-app-pub-XXX/IOS_ASSET_DETAIL",
  people_bottom: "ca-app-pub-XXX/IOS_PEOPLE",
  zakat_bottom: "ca-app-pub-XXX/IOS_ZAKAT",
};

// ----- Google's official Test IDs (safe to use in dev) -----
export const TEST_IDS = {
  web_adsense_client: "ca-pub-0000000000000000",
  web_adsense_slot: "0000000000",
  android_banner: "ca-app-pub-3940256099942544/6300978111",
  android_interstitial: "ca-app-pub-3940256099942544/1033173712",
  android_reward: "ca-app-pub-3940256099942544/5224354917",
  ios_banner: "ca-app-pub-3940256099942544/2934735716",
  ios_interstitial: "ca-app-pub-3940256099942544/4411468910",
  ios_reward: "ca-app-pub-3940256099942544/1712485313",
};

// Convenience mirror for symmetry with TEST_IDS
export const PRODUCTION_IDS = {
  web: { client: WEB_ADSENSE_CLIENT, slots: WEB_ADSENSE_SLOTS },
  android: { app: ANDROID_ADMOB_APP, units: ANDROID_ADMOB_UNITS },
  ios: { app: IOS_ADMOB_APP, units: IOS_ADMOB_UNITS },
};

// ----- Default placement → format mapping -----
export const PLACEMENT_FORMAT: Record<AdPlacement, AdFormat> = {
  dashboard_top: "banner",
  dashboard_bottom: "rectangle",
  transactions_inline: "native",
  reports_bottom: "rectangle",
  settings_banner: "banner",
  assets_list_bottom: "banner",
  asset_details_bottom: "rectangle",
  people_bottom: "banner",
  zakat_bottom: "banner",
};

// ----- User preferences (localStorage) -----
export type AdPrefs = {
  enabled: boolean;
  personalized: boolean;
  premium: boolean;
  testMode: boolean;
  showPlaceholder: boolean;
};

export const DEFAULT_AD_PREFS: AdPrefs = {
  enabled: false,           // OFF by default — no real ads anywhere
  personalized: false,
  premium: false,
  testMode: true,
  showPlaceholder: true,    // visible reserved slot in dev
};

export const AD_PREFS_KEY = "rasd.adPrefs.v1";
