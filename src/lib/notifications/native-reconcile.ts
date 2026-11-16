/** Pure planner for Android's persisted reminder state versus actual OS alarms. */
export interface ReminderEntry { key: string; when: Date }

export function compareNativeReminderState(
  persisted: Record<string, string>,
  desired: Map<number, ReminderEntry>,
  osPendingIds: Set<number>,
): { toSchedule: Array<[number, ReminderEntry]>; toCancel: number[] } {
  const toSchedule = [...desired.entries()].filter(([id, entry]) =>
    persisted[String(id)] !== entry.key || !osPendingIds.has(id));
  // If a hashed ID is reused by a different event, scheduling replaces it.
  // Never cancel a newly written notification with a reused ID.
  const toCancel = Object.keys(persisted)
    .map(Number)
    .filter((id) => Number.isInteger(id) && !desired.has(id) && osPendingIds.has(id));
  return { toSchedule, toCancel };
}
