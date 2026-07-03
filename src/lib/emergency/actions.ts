// =============================================================
// PART 5 — Emergency Mode: actions
// -------------------------------------------------------------
// STRICT SAFETY RULE (enforced by omission, not by a runtime check):
// there is NO disableFinancialEngine(), NO disableBackup(), and NO
// disableAuthentication() function anywhere in this module, or
// anywhere in this app. Those three systems cannot be toggled off —
// full stop, by design. Every action below only flips a flag in
// mode.ts's local state and logs it to the existing Audit Log
// (system/audit.ts) — it never edits the Ads/Notifications/Beta
// engines' own files or behavior.
// =============================================================
import { persistEmergencyMode } from "./mode";
import { createAuditEntry } from "@/lib/system/audit";

export function enableMaintenanceMode(): void {
  persistEmergencyMode({ maintenanceMode: true });
  createAuditEntry("settings_change", "تفعيل وضع الصيانة (Emergency Mode)");
}

export function disableMaintenanceMode(): void {
  persistEmergencyMode({ maintenanceMode: false });
  createAuditEntry("settings_change", "إيقاف وضع الصيانة (Emergency Mode)");
}

export function disableAds(): void {
  persistEmergencyMode({ adsDisabled: true });
  createAuditEntry("settings_change", "تعطيل الإعلانات (Emergency Mode)");
}

export function enableAds(): void {
  persistEmergencyMode({ adsDisabled: false });
  createAuditEntry("settings_change", "تفعيل الإعلانات (Emergency Mode)");
}

export function disableNotifications(): void {
  persistEmergencyMode({ notificationsDisabled: true });
  createAuditEntry("settings_change", "تعطيل الإشعارات (Emergency Mode)");
}

export function enableNotifications(): void {
  persistEmergencyMode({ notificationsDisabled: false });
  createAuditEntry("settings_change", "تفعيل الإشعارات (Emergency Mode)");
}

export function disableBeta(): void {
  persistEmergencyMode({ betaDisabled: true });
  createAuditEntry("settings_change", "تعطيل ميزات Beta (Emergency Mode)");
}

export function enableBeta(): void {
  persistEmergencyMode({ betaDisabled: false });
  createAuditEntry("settings_change", "تفعيل ميزات Beta (Emergency Mode)");
}
