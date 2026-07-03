// =============================================================
// PART 5 — Emergency Mode: audit
// =============================================================
import { loadEmergencyMode, type EmergencyModeState } from "./mode";

export interface EmergencyModeAuditReport {
  state: EmergencyModeState;
  activeOverrides: string[];
  protectedSystems: string[]; // cannot be disabled via this module, by design
  generatedAt: string;
}

export function auditEmergencyMode(): EmergencyModeAuditReport {
  const state = loadEmergencyMode();
  const activeOverrides: string[] = [];
  if (state.maintenanceMode) activeOverrides.push("وضع الصيانة مفعّل");
  if (state.adsDisabled) activeOverrides.push("الإعلانات معطّلة يدوياً");
  if (state.notificationsDisabled) activeOverrides.push("الإشعارات معطّلة يدوياً");
  if (state.betaDisabled) activeOverrides.push("ميزات Beta معطّلة يدوياً");

  return {
    state,
    activeOverrides,
    protectedSystems: [
      "المحرك المالي (Financial Engine)",
      "محرك النسخ الاحتياطي (Backup Engine)",
      "المصادقة (Authentication)",
    ],
    generatedAt: new Date().toISOString(),
  };
}
