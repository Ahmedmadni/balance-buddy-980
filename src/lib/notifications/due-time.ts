import type { EventPriority } from "@/lib/events/engine";
import { isWithinQuietHours, type QuietHours } from "./config";

/** Date-only financial due dates are calendar dates, not UTC instants. */
export function parseDueDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]), month = Number(dateOnly[2]), day = Number(dateOnly[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Calendar dates get a default local 09:00 reminder. Explicit timestamps keep
 * their time. Quiet-hours reminders shift to the next allowed local time;
 * never move them earlier than the actual due time.
 */
export function plannedReminderTime(
  raw: string,
  quiet: QuietHours,
  priority: EventPriority,
  allDay = false,
): Date | null {
  const due = parseDueDate(raw);
  if (!due) return null;
  const dateOnly = allDay || /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const at = dateOnly
    ? new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9, 0)
    : new Date(due.getTime());
  if (quiet.enabled && priority !== "critical" && isWithinQuietHours(quiet, at)) {
    const [hours, minutes] = quiet.end.split(":").map(Number);
    if (!Number.isInteger(hours) || hours < 0 || hours > 23 ||
        !Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
    const next = new Date(at.getFullYear(), at.getMonth(), at.getDate(), hours, minutes);
    if (next <= at) next.setDate(next.getDate() + 1);
    if (isWithinQuietHours(quiet, next)) return null;
    return next;
  }
  return at;
}
