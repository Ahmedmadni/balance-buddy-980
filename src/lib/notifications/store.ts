// =============================================================
// Notification log — persisted delivery status + Notification Center data.
// -------------------------------------------------------------
// Stored entirely in localStorage (same convention as ReminderPrefs /
// AdPrefs elsewhere in the app): no new Supabase table, no schema change.
// This is what powers dedupe (don't re-notify the same event/channel) and
// the read/archive/delete actions in the Notification Center.
// =============================================================
import type { EventPriority } from "@/lib/events/engine";
import type { NotificationChannel } from "./config";

export type NotificationLogStatus = "sent" | "failed" | "skipped";

export interface StoredNotification {
  id: string; // uuid — unique log row
  eventId: string; // source event id (system_events row or derived id from events/engine.ts)
  channel: NotificationChannel;
  title: string;
  body?: string;
  priority: EventPriority;
  dueDate: string; // ISO, copied from the source event
  status: NotificationLogStatus;
  reason?: string;
  error?: string;
  createdAt: string; // ISO — when this log row was written
  readAt: string | null;
  archivedAt: string | null;
}

const LOG_KEY = "rasd.notificationLog.v1";
const MAX_ENTRIES = 500;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `n_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadNotificationLog(): StoredNotification[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persist(log: StoredNotification[]) {
  if (typeof localStorage === "undefined") return;
  const trimmed = log
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, MAX_ENTRIES);
  localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
}

/** Has this event already produced a `sent` log entry on this channel? Used for dedupe. */
export function hasBeenSent(eventId: string, channel: NotificationChannel): boolean {
  return loadNotificationLog().some(
    (n) => n.eventId === eventId && n.channel === channel && n.status === "sent",
  );
}

export function recordNotification(
  entry: Omit<StoredNotification, "id" | "createdAt" | "readAt" | "archivedAt">,
): StoredNotification {
  const row: StoredNotification = {
    ...entry,
    id: uuid(),
    createdAt: new Date().toISOString(),
    readAt: null,
    archivedAt: null,
  };
  const log = loadNotificationLog();
  log.push(row);
  persist(log);
  return row;
}

export function markRead(id: string) {
  const log = loadNotificationLog();
  const row = log.find((n) => n.id === id);
  if (row && !row.readAt) row.readAt = new Date().toISOString();
  persist(log);
}

export function markAllRead() {
  const log = loadNotificationLog();
  const now = new Date().toISOString();
  for (const row of log) if (!row.readAt) row.readAt = now;
  persist(log);
}

export function archiveNotification(id: string) {
  const log = loadNotificationLog();
  const row = log.find((n) => n.id === id);
  if (row) row.archivedAt = new Date().toISOString();
  persist(log);
}

export function deleteNotification(id: string) {
  persist(loadNotificationLog().filter((n) => n.id !== id));
}

export function clearArchived() {
  persist(loadNotificationLog().filter((n) => !n.archivedAt));
}

export interface NotificationBuckets {
  unread: StoredNotification[];
  today: StoredNotification[];
  this_week: StoredNotification[];
  all: StoredNotification[];
}

export function bucketNotifications(log: StoredNotification[]): NotificationBuckets {
  const active = log.filter((n) => !n.archivedAt);
  const now = new Date();
  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today0);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(today0);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const buckets: NotificationBuckets = { unread: [], today: [], this_week: [], all: active };
  for (const n of active) {
    if (!n.readAt) buckets.unread.push(n);
    const created = new Date(n.createdAt);
    if (created >= today0 && created <= endOfToday) buckets.today.push(n);
    else if (created > endOfToday && created <= endOfWeek) buckets.this_week.push(n);
  }
  return buckets;
}
