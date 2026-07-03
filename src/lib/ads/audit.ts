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
