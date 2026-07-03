// =============================================================
// Ad Rules Engine — evaluateAdVisibility()
// -------------------------------------------------------------
// Pure function extracted from the logic that used to live inline in
// AdSlot.tsx, so it's independently testable/reusable (Ads Dashboard,
// Premium validation, release checklist) without duplicating the
// decision. AdSlot.tsx now calls this instead of re-implementing it —
// same outcome, zero behavior change.
// =============================================================
import type { AdPlacement, AdPlatform, AdPrefs } from "./ad-config";
import { PLACEMENT_FORMAT } from "./placements";

export type AdVisibilityReason =
  | "premium_user"
  | "placement_disabled"
  | "format_not_inline"
  | "ads_disabled"
  | "placeholder_preview"
  | "eligible";

export interface AdVisibilityContext {
  placement: AdPlacement;
  prefs: AdPrefs;
  platform: AdPlatform;
  /** Mirrors AdSlot's `enabled` prop — a per-instance override, defaults to true. */
  placementEnabled?: boolean;
}

export interface AdVisibilityResult {
  visible: boolean;
  reason: AdVisibilityReason;
  /** True when what would render is the dev-only dashed placeholder box, not a real ad. */
  isPlaceholder: boolean;
  platform: AdPlatform;
}

export function evaluateAdVisibility(ctx: AdVisibilityContext): AdVisibilityResult {
  const { placement, prefs, platform } = ctx;
  const placementEnabled = ctx.placementEnabled ?? true;

  if (prefs.premium) {
    return { visible: false, reason: "premium_user", isPlaceholder: false, platform };
  }
  if (!placementEnabled) {
    return { visible: false, reason: "placement_disabled", isPlaceholder: false, platform };
  }
  const format = PLACEMENT_FORMAT[placement];
  if (format === "interstitial" || format === "reward") {
    return { visible: false, reason: "format_not_inline", isPlaceholder: false, platform };
  }
  if (!prefs.enabled && !prefs.showPlaceholder) {
    return { visible: false, reason: "ads_disabled", isPlaceholder: false, platform };
  }
  // Real ads are never actually loaded in this build (no SDK) — "enabled"
  // here only controls whether the reserved dashed placeholder shows.
  return {
    visible: true,
    reason: prefs.enabled ? "eligible" : "placeholder_preview",
    isPlaceholder: true,
    platform,
  };
}
