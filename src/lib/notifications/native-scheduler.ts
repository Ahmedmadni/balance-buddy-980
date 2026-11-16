import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { computeUpcomingEvents } from "@/lib/events/engine";
import { isWithinQuietHours, loadNotificationSettings, passesPriorityFilter } from "./config";
import { loadReminderPrefs } from "@/lib/events/engine";

interface Planned { user: string; entries: Record<string, string> }
const KEY = "rasd.native-reminders.v1";
const MAX_REMINDERS = 50;

function loadPlan(): Planned {
  try {
    const plan = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (plan?.user && plan?.entries && typeof plan.entries === "object") return plan;
  } catch { /* device state may be cleared */ }
  return { user: "", entries: {} };
}

function savePlan(plan: Planned) { localStorage.setItem(KEY, JSON.stringify(plan)); }

function nativeId(key: string): number {
  // Positive stable Android notification IDs, in an app-owned range.
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return 600_000_000 + ((hash >>> 0) % 400_000_000);
}

async function clearEntries(plan: Planned): Promise<void> {
  const notifications = Object.keys(plan.entries).map((id) => ({ id: Number(id) }));
  if (notifications.length) await LocalNotifications.cancel({ notifications });
}

export async function clearNativeReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const plan = loadPlan();
  await clearEntries(plan);
  localStorage.removeItem(KEY);
}

/**
 * Schedules opted-in upcoming reminders while online so Android can display
 * them after the app closes. No hidden permission prompt on app startup.
 */
export async function syncNativeReminders(
  userId: string,
  opts: { askPermission?: boolean } = {},
): Promise<{ scheduled: number; permission: string }> {
  if (!Capacitor.isNativePlatform()) return { scheduled: 0, permission: "web" };
  const settings = loadNotificationSettings();
  const prefs = loadReminderPrefs();
  const previous = loadPlan();

  if (previous.user && previous.user !== userId) {
    await clearEntries(previous);
    savePlan({ user: userId, entries: {} });
  }
  if (!settings.enabled || !settings.channels.local || !prefs.enabled) {
    await clearNativeReminders();
    return { scheduled: 0, permission: "disabled" };
  }

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted" && opts.askPermission) {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== "granted") return { scheduled: 0, permission: "denied" };

  // Do not cancel already scheduled reminders when the network/database fails.
  const { all } = await computeUpcomingEvents({ horizonDays: 30 });
  const now = Date.now();
  const desired = new Map<number, { when: Date; key: string }>();
  const userPlan = previous.user === userId ? previous : loadPlan();

  for (const event of all) {
    if (desired.size >= MAX_REMINDERS) break;
    if (event.status !== "pending" || !passesPriorityFilter(event.priority, settings.priorityFilter)) continue;
    const due = new Date(event.due_date);
    if (Number.isNaN(+due)) continue;
    const at = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9, 0);
    if (settings.quietHours.enabled && isWithinQuietHours(settings.quietHours, at) && event.priority !== "critical") {
      // Shift to the quiet-period end rather than sending during quiet hours.
      const [hour, minute] = settings.quietHours.end.split(":").map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
      at.setHours(hour, minute, 0, 0);
      if (isWithinQuietHours(settings.quietHours, at)) continue;
    }
    if (+at < now + 60_000 || +at > now + 31 * 86_400_000) continue;
    const key = `${userId}:${event.id}:${event.due_date}:${at.toISOString()}`;
    let id = nativeId(key);
    while (desired.has(id) && desired.get(id)?.key !== key) {
      id = id === 999_999_999 ? 600_000_000 : id + 1;
    }
    desired.set(id, { key, when: at });
  }

  const saved = Object.entries(userPlan.entries);
  const old = saved.filter(([id, key]) => desired.get(Number(id))?.key !== key);
  const toCreate = [...desired.entries()].filter(([id, entry]) => userPlan.entries[String(id)] !== entry.key);
  if (old.length) await LocalNotifications.cancel({ notifications: old.map(([id]) => ({ id: Number(id) })) });
  if (toCreate.length) await LocalNotifications.schedule({
    notifications: toCreate.map(([id, entry]) => ({
      id, title: "تذكير مالي — رصد", body: "افتح رصد لمراجعة موعد استحقاق",
      schedule: { at: entry.when }, extra: { rasd: true },
    })),
  });
  savePlan({ user: userId, entries: Object.fromEntries([...desired.entries()].map(([id, entry]) => [String(id), entry.key])) });
  return { scheduled: desired.size, permission: "granted" };
}
