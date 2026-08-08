// =============================================================
// Ads Production Audit (Prompt 30 — PART 18)
// -------------------------------------------------------------
// Read-only. Composes the existing Ads Engine audit (./audit.ts) and
// the consent manager audit — it does not re-implement either, and it
// never loads an SDK or a network request.
// =============================================================
import { auditAdsConfiguration, isPlaceholderId } from "./audit";
import { ANDROID_ADMOB_APP, ANDROID_ADMOB_UNITS, TEST_IDS, loadAdPrefs } from "./ad-config";
import { auditConsentManager } from "@/lib/consent/audit";
import type { HealthStatus } from "@/lib/system/health";

export interface AdsProductionAudit {
  appIdConfigured: boolean;
  bannerIdConfigured: boolean;
  testModeActive: boolean;
  consentIntegrated: boolean;
  androidSdkIntegrated: boolean;
  premiumBypass: boolean;
  score: number;
  status: HealthStatus;
  blockers: string[];
  warnings: string[];
  generatedAt: string;
}

export function auditAdsProduction(): AdsProductionAudit {
  const cfg = auditAdsConfiguration();
  const consent = auditConsentManager();
  const prefs = loadAdPrefs();

  const appIdConfigured = !isPlaceholderId(ANDROID_ADMOB_APP);
  const bannerIdConfigured = !isPlaceholderId(ANDROID_ADMOB_UNITS.dashboard_bottom);
  // Static fact: AdProviderRoot ships NoopAdProvider only — no AdMob SDK,
  // no @capacitor-community/admob dependency, and no android/ platform.
  const androidSdkIntegrated = false;
  const testModeActive = prefs.testMode || !appIdConfigured;
  const consentIntegrated = consent.score >= 60;
  const premiumBypass = true; // ad-context disables every slot when prefs.premium

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!appIdConfigured) blockers.push("AdMob App ID لا يزال placeholder في src/lib/ads/ad-config.ts");
  if (!bannerIdConfigured) blockers.push("Banner Unit ID لا يزال placeholder");
  if (!androidSdkIntegrated) blockers.push("لا يوجد AdMob SDK مثبّت (لا منصّة android/ ولا حزمة Capacitor AdMob)");
  if (!consentIntegrated) blockers.push("نظام الموافقة (Consent) غير جاهز لربط الإعلانات");
  if (testModeActive) warnings.push("الإعلانات تعمل بمعرّفات الاختبار فقط (TEST IDs) — هذا هو السلوك المطلوب قبل الإنتاج");
  if (!prefs.personalized) warnings.push("الإعلانات المخصّصة معطّلة — سيتم استخدام non-personalized ads");
  if (cfg.web.usingTestId) warnings.push("AdSense (الويب) لا يزال بمعرّف اختباري");

  const checks = [appIdConfigured, bannerIdConfigured, androidSdkIntegrated, consentIntegrated, premiumBypass];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const status: HealthStatus = blockers.length === 0 ? (warnings.length ? "warning" : "ok") : score >= 50 ? "warning" : "error";

  return {
    appIdConfigured,
    bannerIdConfigured,
    testModeActive,
    consentIntegrated,
    androidSdkIntegrated,
    premiumBypass,
    score,
    status,
    blockers,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

/** Google's official test unit used while ADS_ENV !== "production". */
export const ANDROID_TEST_BANNER = TEST_IDS.android_banner;
