// =============================================================
// PART 1 — auditAdsConfiguration()
// -------------------------------------------------------------
// Read-only inspection of the placeholder config in ad-config.ts against
// the placement registry in placements.ts. Never loads a script, never
// calls a network — it only compares strings already sitting in code.
// =============================================================
import {
  WEB_ADSENSE_CLIENT,
  WEB_ADSENSE_SLOTS,
  ANDROID_ADMOB_APP,
  ANDROID_ADMOB_UNITS,
  IOS_ADMOB_APP,
  IOS_ADMOB_UNITS,
  TEST_IDS,
} from "./ad-config";
import { AD_PLACEMENTS, type AdPlacement, type AdFormat } from "./placements";

/** True when an ID still looks like one of the shipped placeholders (AdMob "...XXX...", AdSense sequential "000000000N", or a known Google test ID). */
export function isPlaceholderId(id: string): boolean {
  return /X{3,}/.test(id) || /^0{6,}\d*$/.test(id) || Object.values(TEST_IDS).includes(id);
}

export interface AdsPlatformAudit {
  configured: boolean; // app/client id no longer a placeholder
  usingTestId: boolean;
  idPreview: string;
  detail: string;
}

export interface AdsPlacementAudit {
  id: AdPlacement;
  label: string;
  format: AdFormat;
  webSlotConfigured: boolean;
  androidUnitConfigured: boolean;
  iosUnitConfigured: boolean;
}

export interface AdsConfigurationAudit {
  web: AdsPlatformAudit;
  android: AdsPlatformAudit;
  ios: AdsPlatformAudit;
  placements: AdsPlacementAudit[];
  generatedAt: string;
}

function platformAudit(id: string, label: string): AdsPlatformAudit {
  const configured = !isPlaceholderId(id);
  return {
    configured,
    usingTestId: !configured,
    idPreview: id,
    detail: configured
      ? `${label}: معرّف حقيقي مُعدّ`
      : `${label}: لا يزال placeholder — استبدله في src/lib/ads/ad-config.ts`,
  };
}

export function auditAdsConfiguration(): AdsConfigurationAudit {
  const web = platformAudit(WEB_ADSENSE_CLIENT, "Web AdSense Client ID");
  const android = platformAudit(ANDROID_ADMOB_APP, "Android AdMob App ID");
  const ios = platformAudit(IOS_ADMOB_APP, "iOS AdMob App ID");

  const placements: AdsPlacementAudit[] = AD_PLACEMENTS.map((p) => ({
    id: p.id,
    label: p.label,
    format: p.format,
    webSlotConfigured: !isPlaceholderId(WEB_ADSENSE_SLOTS[p.id]),
    androidUnitConfigured: !isPlaceholderId(ANDROID_ADMOB_UNITS[p.id]),
    iosUnitConfigured: !isPlaceholderId(IOS_ADMOB_UNITS[p.id]),
  }));

  return { web, android, ios, placements, generatedAt: new Date().toISOString() };
}

// =============================================================
// PART 14 — auditAds(): runtime-facing readiness snapshot.
// Reports configured/missing only — never echoes a full secret ID.
// =============================================================
import { ADS_MODE, loadAdPrefs } from "./ad-config";
import { detectPlatform } from "./ad-provider";
import { auditConsentManager } from "@/lib/consent/audit";

export interface AdsRuntimeAudit {
  provider: "noop" | "web-adsense" | "android-admob" | "ios-admob";
  platform: "web" | "android" | "ios";
  appIdConfigured: boolean;
  bannerUnitConfigured: boolean;
  consentReady: boolean;
  mode: "test" | "production";
  adsEnabled: boolean;
  productionReady: boolean;
  missing: string[];
}

export function auditAds(): AdsRuntimeAudit {
  const platform = detectPlatform();
  const cfg = auditAdsConfiguration();
  const prefs = loadAdPrefs();
  const consent = auditConsentManager();

  const appIdConfigured =
    platform === "android" ? cfg.android.configured : platform === "ios" ? cfg.ios.configured : cfg.web.configured;
  const bannerUnitConfigured =
    platform === "ios"
      ? !isPlaceholderId(IOS_ADMOB_UNITS.dashboard_bottom)
      : platform === "android"
        ? !isPlaceholderId(ANDROID_ADMOB_UNITS.dashboard_bottom)
        : cfg.placements.some((p) => p.webSlotConfigured);

  const missing: string[] = [];
  if (!appIdConfigured) missing.push("App/Client ID غير مُعدّ");
  if (!bannerUnitConfigured) missing.push("Banner Unit ID غير مُعدّ");
  if (consent.score < 60) missing.push("نظام الموافقة غير جاهز");
  if (ADS_MODE !== "production") missing.push("وضع الإعلانات = test");

  // No SDK is bundled today — the active provider is always the Noop one.
  const adsEnabled = prefs.enabled && !prefs.premium && appIdConfigured && bannerUnitConfigured && missing.length === 0;

  return {
    provider: "noop",
    platform,
    appIdConfigured,
    bannerUnitConfigured,
    consentReady: consent.score >= 60,
    mode: ADS_MODE,
    adsEnabled,
    productionReady: missing.length === 0,
    missing,
  };
}
