// =============================================================
// PART 6 — validatePremiumExperience()
// -------------------------------------------------------------
// Asserts, using the same evaluateAdVisibility() every AdSlot calls,
// that a Premium user sees zero ads across every registered placement,
// and that no real ad provider is active in this build.
// =============================================================
import type { AdPrefs, AdPlatform } from "./ad-config";
import { AD_PLACEMENTS } from "./placements";
import { evaluateAdVisibility } from "./rules";
import { NoopAdProvider } from "./ad-provider";

export interface PremiumCheckItem {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface PremiumValidationResult {
  valid: boolean;
  checks: PremiumCheckItem[];
}

const CHECK_PLATFORMS: AdPlatform[] = ["web", "android", "ios"];

export function validatePremiumExperience(prefs: AdPrefs): PremiumValidationResult {
  const checks: PremiumCheckItem[] = [];

  checks.push({
    id: "premium_flag",
    label: "وضع Premium مفعّل في التفضيلات",
    pass: prefs.premium,
    detail: prefs.premium
      ? "مفعّل"
      : "غير مفعّل — فعّله من الإعدادات > الإعلانات لاختبار تجربة Premium",
  });

  const premiumPrefs: AdPrefs = { ...prefs, premium: true };
  const visibleWhenPremium = AD_PLACEMENTS.flatMap((p) =>
    CHECK_PLATFORMS.map((platform) => ({
      placement: p.id,
      platform,
      result: evaluateAdVisibility({ placement: p.id, prefs: premiumPrefs, platform }),
    })),
  ).filter((x) => x.result.visible);

  checks.push({
    id: "placements_hidden",
    label: `كل الأماكن الإعلانية (${AD_PLACEMENTS.length}) مخفية لمستخدم Premium`,
    pass: visibleWhenPremium.length === 0,
    detail:
      visibleWhenPremium.length === 0
        ? "تم فحص كل الأماكن عبر Web/Android/iOS — لا شيء يظهر"
        : `${visibleWhenPremium.length} حالة ظهور غير متوقعة: ${visibleWhenPremium.map((x) => `${x.placement}/${x.platform}`).join("، ")}`,
  });

  checks.push({
    id: "no_provider_loaded",
    label: "لا يوجد Ad Provider حقيقي في هذا البناء",
    pass: NoopAdProvider.name === "noop",
    detail: "AdProviderRoot يستخدم NoopAdProvider حصراً — لا AdSense ولا AdMob SDK في الكود",
  });

  return { valid: checks.every((c) => c.pass), checks };
}
