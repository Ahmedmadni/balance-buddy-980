// =============================================================
// PART 1 — Feature Flags Engine: evaluation
// -------------------------------------------------------------
// Resolution order for isFeatureEnabled(): explicit local override
// always wins; otherwise the flag's `type` decides, with "production"
// additionally gated by a stable per-device rollout bucket.
// =============================================================
import { FEATURE_FLAGS, getFeatureDef } from "./config";
import { getOverride, setOverride, clearOverride, getDeviceBucket } from "./storage";
import type { FeatureEvalContext, FeatureState } from "./types";

export function isFeatureEnabled(id: string, ctx: FeatureEvalContext = {}): boolean {
  const override = getOverride(id);
  if (override !== null) return override;

  const def = getFeatureDef(id);
  if (!def) return false; // unknown flag — safe default

  switch (def.type) {
    case "always":
      return true;
    case "disabled":
      return false;
    case "development":
      return !!import.meta.env?.DEV;
    case "internal":
      return false; // requires an explicit override to turn on — no "internal tester" concept exists yet
    case "beta":
      return def.rollout.betaOnly ? !!ctx.isBeta : true;
    case "premium":
      return !!ctx.isPremium;
    case "production": {
      if (def.rollout.betaOnly && !ctx.isBeta) return false;
      if (def.rollout.premiumOnly && !ctx.isPremium) return false;
      return getDeviceBucket() < def.rollout.rollout;
    }
    default:
      return false;
  }
}

export function enableFeature(id: string): void {
  setOverride(id, true);
}

export function disableFeature(id: string): void {
  setOverride(id, false);
}

export function resetFeatureOverride(id: string): void {
  clearOverride(id);
}

export function getFeatureState(id: string, ctx: FeatureEvalContext = {}): FeatureState | null {
  const def = getFeatureDef(id);
  if (!def) return null;
  return {
    id: def.id,
    label: def.label,
    type: def.type,
    enabled: isFeatureEnabled(id, ctx),
    override: getOverride(id),
  };
}

export function listFeatureStates(ctx: FeatureEvalContext = {}): FeatureState[] {
  return FEATURE_FLAGS.map((f) => getFeatureState(f.id, ctx)).filter(
    (s): s is FeatureState => s !== null,
  );
}
