// =============================================================
// PART 1 — Feature Flags Engine: audit
// -------------------------------------------------------------
// Summary counts for the Operational Health Dashboard (PART 4):
// total, enabled, disabled, beta-type, premium-type.
// =============================================================
import { loadAdPrefs } from "@/lib/ads/ad-config";
import { listFeatureStates } from "./engine";

export interface FeatureFlagsAuditReport {
  total: number;
  enabledCount: number;
  disabledCount: number;
  betaCount: number;
  premiumCount: number;
  generatedAt: string;
}

export function auditFeatureFlags(): FeatureFlagsAuditReport {
  const ctx = { isPremium: loadAdPrefs().premium };
  const states = listFeatureStates(ctx);

  return {
    total: states.length,
    enabledCount: states.filter((s) => s.enabled).length,
    disabledCount: states.filter((s) => !s.enabled).length,
    betaCount: states.filter((s) => s.type === "beta").length,
    premiumCount: states.filter((s) => s.type === "premium").length,
    generatedAt: new Date().toISOString(),
  };
}
