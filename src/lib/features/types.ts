// =============================================================
// PART 1 — Feature Flags Engine: shared types
// =============================================================

export type FeatureType =
  | "always"
  | "development"
  | "internal"
  | "beta"
  | "premium"
  | "production"
  | "disabled";

export interface FeatureRolloutConfig {
  rollout: number; // 0-100 — % of devices (by stable local bucket) included when type === "production"
  betaOnly: boolean;
  premiumOnly: boolean;
}

export interface FeatureFlagDef {
  id: string;
  label: string;
  type: FeatureType;
  description: string;
  rollout: FeatureRolloutConfig;
}

export interface FeatureEvalContext {
  isBeta?: boolean;
  isPremium?: boolean;
}

export type FeatureOverride = boolean | null; // null = no override, follow the flag's type/rollout

export interface FeatureState {
  id: string;
  label: string;
  type: FeatureType;
  enabled: boolean;
  override: FeatureOverride;
}
