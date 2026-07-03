// =============================================================
// PART 5 — Emergency Mode: state
// -------------------------------------------------------------
// A localStorage-only kill-switch STATE STORE. Deliberately does not
// wire itself into the actual notifications/ads engines' runtime code
// (that would require editing those frozen files) — these flags are
// advisory, surfaced on the Operations dashboard for an operator to
// act on manually. See actions.ts for why Financial Engine, Backup
// Engine, and Authentication have no disable functions at all.
// =============================================================

export interface EmergencyModeState {
  maintenanceMode: boolean;
  adsDisabled: boolean;
  notificationsDisabled: boolean;
  betaDisabled: boolean;
  updatedAt: string | null;
}

const KEY = "rasd.emergencyMode.v1";

const DEFAULT_STATE: EmergencyModeState = {
  maintenanceMode: false,
  adsDisabled: false,
  notificationsDisabled: false,
  betaDisabled: false,
  updatedAt: null,
};

export function loadEmergencyMode(): EmergencyModeState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULT_STATE, ...raw };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function persistEmergencyMode(patch: Partial<EmergencyModeState>): EmergencyModeState {
  const next: EmergencyModeState = {
    ...loadEmergencyMode(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota — best effort */
    }
  }
  return next;
}
