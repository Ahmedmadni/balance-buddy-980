// =============================================================
// PART 3 — Remote Config Engine
// -------------------------------------------------------------
// Source-pluggable: RemoteConfigSource is the seam a future real
// backend slots into without any calling code changing —
//   class SupabaseConfigSource implements RemoteConfigSource { ... }
//   class FirebaseRemoteConfigSource implements RemoteConfigSource { ... }
//   class JsonCdnConfigSource implements RemoteConfigSource { ... }
// Today only LocalStorageConfigSource exists, reading rasd.remoteConfig.v1.
// =============================================================
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigValues } from "./config";

const STORAGE_KEY = "rasd.remoteConfig.v1";

export interface RemoteConfigSource {
  id: string;
  fetchConfig(): Promise<Partial<RemoteConfigValues>>;
}

class LocalStorageConfigSource implements RemoteConfigSource {
  id = "localStorage";
  async fetchConfig(): Promise<Partial<RemoteConfigValues>> {
    if (typeof localStorage === "undefined") return {};
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }
}

let activeSource: RemoteConfigSource = new LocalStorageConfigSource();
let cachedValues: RemoteConfigValues = { ...DEFAULT_REMOTE_CONFIG };
let lastLoadedAt: string | null = null;

export function setRemoteConfigSource(source: RemoteConfigSource): void {
  activeSource = source;
}

export function getRemoteConfigSource(): RemoteConfigSource {
  return activeSource;
}

export async function loadRemoteConfig(): Promise<RemoteConfigValues> {
  const fetched = await activeSource.fetchConfig();
  cachedValues = { ...DEFAULT_REMOTE_CONFIG, ...fetched };
  lastLoadedAt = new Date().toISOString();
  return cachedValues;
}

export function getCachedRemoteConfig(): RemoteConfigValues {
  return cachedValues;
}

export function getRemoteConfigValue<K extends keyof RemoteConfigValues>(
  key: K,
): RemoteConfigValues[K] {
  return cachedValues[key];
}

export function setRemoteConfigValue<K extends keyof RemoteConfigValues>(
  key: K,
  value: RemoteConfigValues[K],
): void {
  cachedValues = { ...cachedValues, [key]: value };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedValues));
    } catch {
      /* quota — best effort */
    }
  }
}

export function getLastLoadedAt(): string | null {
  return lastLoadedAt;
}
