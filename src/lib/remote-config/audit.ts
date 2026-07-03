// =============================================================
// PART 3 — Remote Config Engine: audit
// -------------------------------------------------------------
// Reports load status/key-count/last-update for the Operational Health
// Dashboard (PART 4) — matches its exact required fields.
// =============================================================
import { getCachedRemoteConfig, getRemoteConfigSource, getLastLoadedAt } from "./engine";

export interface RemoteConfigAuditReport {
  loaded: boolean;
  keyCount: number;
  lastUpdate: string | null;
  source: string;
  generatedAt: string;
}

export function auditRemoteConfig(): RemoteConfigAuditReport {
  const values = getCachedRemoteConfig();
  return {
    loaded: getLastLoadedAt() !== null,
    keyCount: Object.keys(values).length,
    lastUpdate: getLastLoadedAt(),
    source: getRemoteConfigSource().id,
    generatedAt: new Date().toISOString(),
  };
}
