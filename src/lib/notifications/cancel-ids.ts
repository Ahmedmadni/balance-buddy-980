/** Gather only Rasd-owned notification IDs. The OS can outlive WebView
 * localStorage, so use plugin extras as a recovery source on sign-out.
 */
export function nativeReminderIdsToCancel(
  localEntries: Readonly<Record<string, string>>,
  pending: ReadonlyArray<{ id: number; extra?: unknown }>,
): number[] {
  const owned = new Set<number>();
  const isOwnedId = (id: number) => Number.isInteger(id) && id >= 600_000_000 && id < 1_000_000_000;
  for (const rawId of Object.keys(localEntries)) {
    const id = Number(rawId);
    if (isOwnedId(id)) owned.add(id);
  }
  for (const entry of pending) {
    if (!isOwnedId(entry.id)) continue;
    const extra = entry.extra;
    if (extra && typeof extra === "object" && !Array.isArray(extra) &&
        (extra as Record<string, unknown>).rasd === true) {
      owned.add(entry.id);
    }
  }
  return [...owned].sort((a, b) => a - b);
}
