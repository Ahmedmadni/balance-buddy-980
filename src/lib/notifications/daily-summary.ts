/** Guarantees at most one overdue-summary schedule attempt per local day
 * for the active device/user even after Android delivers and removes an alarm.
 * When an alarm remains pending, retain its ID without changing its time.
 */
export function dailySummaryDecision(
  key: string,
  lastAttemptedKey: string | undefined,
  storedEntries: Record<string, string>,
  osPendingIds: ReadonlySet<number>,
): { shouldCreate: boolean; keepPendingId: number | null } {
  const pair = Object.entries(storedEntries).find(([, value]) => value === key);
  if (pair) {
    const id = Number(pair[0]);
    return { shouldCreate: false, keepPendingId: osPendingIds.has(id) ? id : null };
  }
  if (lastAttemptedKey === key) return { shouldCreate: false, keepPendingId: null };
  return { shouldCreate: true, keepPendingId: null };
}
