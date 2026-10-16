/**
 * Conservative record-level sync decisions.
 *
 * No network operations, finance mutations, or auth changes.
 * The caller MUST persist user-approved decisions transactionally.
 * IDs/revisions are opaque, stable UUID-like values; timestamps never decide
 * a winner for money records. Explicit deletion uses tombstones.
 */
export interface SyncStamp {
  revision: string;
  digest: string;
  deleted: boolean;
}
export interface SyncItem {
  id: string;
  stamp: SyncStamp;
}
export type SyncDirection = "same" | "upload" | "download" | "conflict";
export interface SyncDecision {
  id: string;
  action: SyncDirection;
  reason: string;
}
const same = (a: SyncStamp, b: SyncStamp) =>
  a.revision === b.revision && a.digest === b.digest && a.deleted === b.deleted;

function indexed(items: readonly SyncItem[], side: string): Map<string, SyncStamp> {
  const records = new Map<string, SyncStamp>();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id.trim()
      || !item.stamp || typeof item.stamp.revision !== "string"
      || !item.stamp.revision || typeof item.stamp.digest !== "string"
      || !item.stamp.digest || typeof item.stamp.deleted !== "boolean") {
      throw new Error(`Invalid ${side} sync item`);
    }
    if (records.has(item.id)) throw new Error(`Duplicate ID in ${side} sync records`);
    records.set(item.id, item.stamp);
  }
  return records;
}
export function planConservativeSync(
  local: readonly SyncItem[],
  cloud: readonly SyncItem[],
  acknowledged: readonly SyncItem[] = [],
): SyncDecision[] {
  const l = indexed(local, "device");
  const c = indexed(cloud, "cloud");
  const base = indexed(acknowledged, "acknowledged");
  const ids = new Set([...l.keys(), ...c.keys(), ...base.keys()]);
  return [...ids].sort().map(id => {
    const a = l.get(id), b = c.get(id), prior = base.get(id);
    if (!a && !b) return { id, action: "conflict", reason: "missing_on_both_sides_after_sync" };
    if (!a || !b) {
      // Never interpret a missing row as a deletion if a previously synced
      // version existed. Explicit tombstones must be carried as full items.
      return prior
        ? { id, action: "conflict", reason: "row_missing_after_sync" }
        : { id, action: a ? "upload" : "download", reason: "new_record" };
    }
    if (same(a, b)) return { id, action: "same", reason: "identical_revision" };
    if (!prior) return { id, action: "conflict", reason: "independent_records_without_baseline" };
    if (same(a, prior)) return { id, action: "download", reason: "device_unchanged" };
    if (same(b, prior)) return { id, action: "upload", reason: "cloud_unchanged" };
    return { id, action: "conflict", reason: "divergent_changes" };
  });
}
