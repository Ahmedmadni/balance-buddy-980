// =============================================================
// PART 3 — Remote Config Engine: values & defaults
// =============================================================

export interface RemoteConfigValues {
  ads_enabled: boolean;
  premium_enabled: boolean;
  notifications_enabled: boolean;
  maintenance_mode: boolean;
  beta_features: boolean;
  rollout_percentage: number;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfigValues = {
  ads_enabled: false,
  premium_enabled: false,
  notifications_enabled: true,
  maintenance_mode: false,
  beta_features: true,
  rollout_percentage: 100,
};

export const REMOTE_CONFIG_KEY_LABEL: Record<keyof RemoteConfigValues, string> = {
  ads_enabled: "تفعيل الإعلانات",
  premium_enabled: "تفعيل Premium",
  notifications_enabled: "تفعيل الإشعارات",
  maintenance_mode: "وضع الصيانة",
  beta_features: "ميزات Beta",
  rollout_percentage: "نسبة الطرح التدريجي",
};
