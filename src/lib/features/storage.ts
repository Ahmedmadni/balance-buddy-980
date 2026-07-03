// =============================================================
// PART 1 — Feature Flags Engine: localStorage persistence
// -------------------------------------------------------------
// Two independent pieces of local state:
//  - per-flag boolean overrides (explicit enable/disable, wins over the
//    flag's declared type/rollout)
//  - a stable anonymous per-device bucket (0-99), generated once and
//    reused forever on this device, used to deterministically decide
//    whether this device falls inside a "production" flag's rollout %
// =============================================================
import type { FeatureOverride } from "./types";

const OVERRIDES_KEY = "rasd.featureFlags.v1";
const BUCKET_KEY = "rasd.featureBucket.v1";

export function loadOverrides(): Record<string, boolean> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function persistOverrides(overrides: Record<string, boolean>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    /* quota — best effort */
  }
}

export function getOverride(id: string): FeatureOverride {
  const overrides = loadOverrides();
  return id in overrides ? overrides[id] : null;
}

export function setOverride(id: string, value: boolean): void {
  const overrides = loadOverrides();
  overrides[id] = value;
  persistOverrides(overrides);
}

export function clearOverride(id: string): void {
  const overrides = loadOverrides();
  delete overrides[id];
  persistOverrides(overrides);
}

export function clearAllOverrides(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(OVERRIDES_KEY);
}

/** Stable 0-99 bucket for this device/browser, generated once and cached forever. */
export function getDeviceBucket(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    const cached = localStorage.getItem(BUCKET_KEY);
    if (cached !== null) {
      const n = Number(cached);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    /* ignore */
  }
  const bucket = Math.floor(Math.random() * 100);
  try {
    localStorage.setItem(BUCKET_KEY, String(bucket));
  } catch {
    /* quota — best effort */
  }
  return bucket;
}
