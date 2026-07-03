// =============================================================
// PART 7 — AdMob Readiness (config audit only, no SDK) and
// PART 8 — generateReleaseChecklist().
// -------------------------------------------------------------
// Read-only. Reuses AdProvider's own config (src/lib/ads/ad-config.ts),
// the Notification engine's settings, the Backup engine's last-backup
// cache, the System Health engine, and computeFinancialInsights() —
// nothing here recomputes any of that differently.
// =============================================================
import { loadAdPrefs } from "@/lib/ads/ad-config";
import { auditAdsConfiguration, type AdsConfigurationAudit } from "@/lib/ads/audit";
import { validatePremiumExperience } from "@/lib/ads/premium";
import { loadNotificationSettings, CHANNEL_AVAILABLE } from "@/lib/notifications/config";
import { loadLastBackup } from "@/lib/backup/engine";
import { runSystemHealthCheck, type HealthStatus } from "@/lib/system/health";
import { computeFinancialInsights } from "@/lib/insights/engine";
import { auditMobileCompatibility, checkOfflineCapabilities } from "./compatibility";
import { captureApplicationError } from "@/lib/system/errors";

// ----- PART 7 (Prompt 18): AdMob Readiness -----
// Thin wrapper over auditAdsConfiguration() (src/lib/ads/audit.ts), the
// single source of truth for placeholder-vs-real ID detection — kept
// here only for its existing narrower {web,android,ios}.configured shape
// used elsewhere in this file.

export interface AdMobPlatformReadiness {
  configured: boolean; // app id / client id no longer looks like a placeholder
  usingTestIds: boolean;
  detail: string;
}

export interface AdMobReadiness {
  web: AdMobPlatformReadiness;
  android: AdMobPlatformReadiness;
  ios: AdMobPlatformReadiness;
}

function toPlatformReadiness(a: AdsConfigurationAudit[keyof Pick<AdsConfigurationAudit, "web" | "android" | "ios">]): AdMobPlatformReadiness {
  return { configured: a.configured, usingTestIds: a.usingTestId, detail: a.detail };
}

export function checkAdMobReadiness(): AdMobReadiness {
  const audit = auditAdsConfiguration();
  return {
    web: toPlatformReadiness(audit.web),
    android: toPlatformReadiness(audit.android),
    ios: toPlatformReadiness(audit.ios),
  };
}

// ----- PART 8: Release Checklist -----

export interface ChecklistItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ReleaseChecklist {
  items: ChecklistItem[];
  overallStatus: HealthStatus;
  generatedAt: string;
}

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = { ok: 0, warning: 1, error: 2 };
  return rank[b] > rank[a] ? b : a;
}

export async function generateReleaseChecklist(): Promise<ReleaseChecklist> {
  const items: ChecklistItem[] = [];

  const compat = auditMobileCompatibility();
  const admob = checkAdMobReadiness();
  const notifSettings = loadNotificationSettings();
  const lastBackup = await loadLastBackup();
  const offline = await checkOfflineCapabilities();

  let health: Awaited<ReturnType<typeof runSystemHealthCheck>> | null = null;
  try {
    health = await runSystemHealthCheck();
  } catch (e) {
    captureApplicationError(e, "runtime", { scope: "generateReleaseChecklist:health" });
  }

  const mobileUnsupported = compat.items.filter((i) => !i.supported);
  items.push({
    id: "android",
    label: "Android Ready",
    status: mobileUnsupported.length === 0 ? "ok" : "warning",
    detail:
      mobileUnsupported.length === 0
        ? "كل فحوصات التوافق ناجحة على هذا البناء"
        : `${mobileUnsupported.length} ميزة غير مؤكدة على هذا البناء: ${mobileUnsupported.map((i) => i.label).join("، ")}`,
  });
  items.push({
    id: "ios",
    label: "iOS Ready",
    status: "warning",
    detail:
      "لا يوجد مسار iOS في هذا المشروع بعد (Capacitor iOS platform لم تُضَف) — راجع MOBILE_BUILD.md",
  });

  const notifChannelsReady = Object.entries(notifSettings.channels).filter(
    ([c, on]) => on && CHANNEL_AVAILABLE[c as keyof typeof CHANNEL_AVAILABLE],
  ).length;
  items.push({
    id: "notifications",
    label: "Notifications Ready",
    status: notifSettings.enabled && notifChannelsReady > 0 ? "ok" : "warning",
    detail: notifSettings.enabled
      ? `${notifChannelsReady} قناة فعّالة وحقيقية (محلية) من أصل ${Object.values(notifSettings.channels).filter(Boolean).length} مفعّلة`
      : "محرك الإشعارات معطّل من الإعدادات",
  });

  const adsReadyStatus: HealthStatus =
    admob.android.configured && admob.ios.configured ? "ok" : "warning";
  items.push({
    id: "ads",
    label: "Ads Ready",
    status: adsReadyStatus,
    detail: `Android: ${admob.android.detail} — iOS: ${admob.ios.detail}`,
  });

  items.push({
    id: "backup",
    label: "Backup Ready",
    status: lastBackup ? "ok" : "warning",
    detail: lastBackup
      ? `آخر نسخة احتياطية محلية بتاريخ ${lastBackup.meta.exported_at}`
      : "لا توجد نسخة احتياطية محفوظة محلياً بعد",
  });

  items.push({
    id: "offline",
    label: "Offline Ready",
    status: offline.ready ? "ok" : "warning",
    detail: offline.ready
      ? "توجد نسخة احتياطية محلية حديثة يمكن الاعتماد عليها دون اتصال"
      : "أنشئ نسخة احتياطية أولاً لضمان توفر بيانات محلية عند انقطاع الاتصال",
  });

  let analyticsStatus: HealthStatus = "ok";
  let analyticsDetail = "محرك الرؤى المالية يعمل ويُنتج نتائج رقمية سليمة";
  try {
    const insights = await computeFinancialInsights();
    if (!Number.isFinite(insights.investments.avgROI ?? 0)) throw new Error("avgROI غير رقمي");
  } catch (e) {
    analyticsStatus = "error";
    analyticsDetail = `فشل تشغيل محرك الرؤى: ${e instanceof Error ? e.message : String(e)}`;
    captureApplicationError(e, "runtime", { scope: "generateReleaseChecklist:analytics" });
  }
  items.push({
    id: "analytics",
    label: "Analytics Ready",
    status: analyticsStatus,
    detail: analyticsDetail,
  });

  if (health && health.status !== "ok") {
    items.push({
      id: "system_health",
      label: "System Health",
      status: health.status,
      detail: "توجد نتائج غير سليمة في الفحص الصحي — راجع /app/system قبل الإطلاق",
    });
  }

  // ----- Prompt 19: Ads Production Ready / Premium Ready / Consent Ready -----
  const adsAudit = auditAdsConfiguration();
  const configuredPlacements = adsAudit.placements.filter(
    (p) => p.webSlotConfigured && p.androidUnitConfigured && p.iosUnitConfigured,
  ).length;
  items.push({
    id: "ads_production",
    label: "Ads Production Ready",
    status:
      adsAudit.web.configured && adsAudit.android.configured && adsAudit.ios.configured && configuredPlacements === adsAudit.placements.length
        ? "ok"
        : "warning",
    detail: `${configuredPlacements}/${adsAudit.placements.length} مكان إعلاني بمعرّفات حقيقية — Web: ${adsAudit.web.configured ? "جاهز" : "placeholder"}، Android: ${adsAudit.android.configured ? "جاهز" : "placeholder"}، iOS: ${adsAudit.ios.configured ? "جاهز" : "placeholder"}`,
  });

  const adPrefs = loadAdPrefs();
  const premiumCheck = validatePremiumExperience(adPrefs);
  items.push({
    id: "premium_ready",
    label: "Premium Ready",
    status: premiumCheck.valid ? "ok" : "warning",
    detail: premiumCheck.checks.map((c) => `${c.pass ? "✓" : "✗"} ${c.label}`).join(" — "),
  });

  // No consent SDK exists by design (explicitly out of scope) — real ads
  // require one in GDPR-applicable regions, so this can never read "ok"
  // until that flow is actually built; reporting anything else would be
  // dishonest, not just cautious.
  items.push({
    id: "consent_ready",
    label: "Consent Ready",
    status: "warning",
    detail: "لا توجد آلية موافقة (Consent) مُنفَّذة بعد — مطلوبة قبل عرض إعلانات حقيقية في مناطق GDPR/CCPA. لم تُبنَ عمداً في هذه المرحلة.",
  });

  const overallStatus = items.reduce<HealthStatus>((acc, i) => worst(acc, i.status), "ok");
  return { items, overallStatus, generatedAt: new Date().toISOString() };
}
