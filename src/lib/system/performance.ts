// =============================================================
// Performance Metrics — collectPerformanceMetrics()
// -------------------------------------------------------------
// Uses only the browser's own Performance/StorageManager APIs — no
// external monitoring SDK, no background sampling loop. Reuses
// computeUpcomingEvents() and the notification log for counts, and the
// backup engine's own local cache (IndexedDB) for backup size.
// =============================================================
import { computeUpcomingEvents } from "@/lib/events/engine";
import { loadNotificationLog } from "@/lib/notifications/store";
import { loadLastBackup } from "@/lib/backup/engine";

export interface QueryTiming {
  label: string;
  ms: number;
}

export interface PerformanceMetrics {
  queryDurations: QueryTiming[];
  localStorageUsageBytes: number;
  storageEstimate: { usageBytes: number | null; quotaBytes: number | null }; // navigator.storage.estimate() — IndexedDB + caches
  lastBackupSizeBytes: number | null;
  lastBackupAt: string | null;
  notificationCount: number;
  eventCount: number;
  collectedAt: string;
}

async function timed<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; timing: QueryTiming }> {
  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  return { result, timing: { label, ms } };
}

function localStorageUsageBytes(): number {
  if (typeof localStorage === "undefined") return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? "";
    total += (key.length + value.length) * 2; // UTF-16 code units ≈ 2 bytes
  }
  return total;
}

export async function collectPerformanceMetrics(): Promise<PerformanceMetrics> {
  const queryDurations: QueryTiming[] = [];

  const eventsTimed = await timed("computeUpcomingEvents", () =>
    computeUpcomingEvents({ horizonDays: 365 }),
  );
  queryDurations.push(eventsTimed.timing);

  const backupTimed = await timed("loadLastBackup", () => loadLastBackup());
  queryDurations.push(backupTimed.timing);

  const renderStart = performance.now();
  await Promise.resolve(); // yields one microtask — cheap proxy for "render tick" cost, no real DOM measurement available outside React
  queryDurations.push({ label: "render_tick", ms: performance.now() - renderStart });

  let storageEstimate: { usageBytes: number | null; quotaBytes: number | null } = {
    usageBytes: null,
    quotaBytes: null,
  };
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      storageEstimate = { usageBytes: est.usage ?? null, quotaBytes: est.quota ?? null };
    } catch {
      /* unsupported in this browser/webview */
    }
  }

  const lastBackup = backupTimed.result;
  const lastBackupSizeBytes = lastBackup ? JSON.stringify(lastBackup).length * 2 : null;

  return {
    queryDurations,
    localStorageUsageBytes: localStorageUsageBytes(),
    storageEstimate,
    lastBackupSizeBytes,
    lastBackupAt: lastBackup?.meta.exported_at ?? null,
    notificationCount: loadNotificationLog().length,
    eventCount: eventsTimed.result.all.length,
    collectedAt: new Date().toISOString(),
  };
}
