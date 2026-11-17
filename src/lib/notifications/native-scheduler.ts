import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { computeUpcomingEvents } from "@/lib/events/engine";
import { loadNotificationSettings, passesPriorityFilter } from "./config";
import { plannedReminderTime } from "./due-time";
import { compareNativeReminderState } from "./native-reconcile";
import { dailySummaryDecision } from "./daily-summary";
import { createAsyncSerialQueue } from "@/lib/mobile/async-serial-queue";
import { loadReminderPrefs } from "@/lib/events/engine";

interface Planned { user: string; entries: Record<string, string>; lastOverdueKey?: string }
const KEY = "rasd.native-reminders.v1";
const MAX_REMINDERS = 50;
// Serialise sync and sign-out cancellation against the same OS alarm set.
const runSerialized = createAsyncSerialQueue();
// Invalidate sync requests still waiting to start when logout is requested.
let cancellationEpoch = 0;

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

async function clearNativeRemindersUnlocked(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const plan = loadPlan();
  await clearEntries(plan);
  localStorage.removeItem(KEY);
}

/**
 * Schedules opted-in upcoming reminders while online so Android can display
 * them after the app closes. No hidden permission prompt on app startup.
 */
async function syncNativeRemindersUnlocked(
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
    await clearNativeRemindersUnlocked();
    return { scheduled: 0, permission: "disabled" };
  }

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted" && opts.askPermission) {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== "granted") return { scheduled: 0, permission: "denied" };

  // Do not cancel already scheduled reminders when the network/database fails.
  const { all, overdue } = await computeUpcomingEvents({ horizonDays: 30 });
  const now = Date.now();
  const desired = new Map<number, { when: Date; key: string }>();
  let scheduledOverdueKey: string | undefined;
  const userPlan = previous.user === userId ? previous : loadPlan();
  // Android can remove scheduled alarms after a reboot, settings change, or
  // OS cleanup. A localStorage entry alone is not proof the alarm still exists.
  const pending = await LocalNotifications.getPending();
  const osPendingIds = new Set(pending.notifications.map((item) => item.id));

  for (const event of all) {
    if (desired.size >= MAX_REMINDERS) break;
    if (event.status !== "pending" || !passesPriorityFilter(event.priority, settings.priorityFilter)) continue;
    const at = plannedReminderTime(event.due_date, settings.quietHours, event.priority, event.metadata?.allDay === true);
    if (!at) continue;
    if (+at < now + 60_000 || +at > now + 31 * 86_400_000) continue;
    const key = `${userId}:${event.id}:${event.due_date}:${at.toISOString()}`;
    let id = nativeId(key);
    while (desired.has(id) && desired.get(id)?.key !== key) {
      id = id === 999_999_999 ? 600_000_000 : id + 1;
    }
    desired.set(id, { key, when: at });
  }

  // Preserve the old foreground-only feature for overdue debts: give an
  // opt-in, privacy-safe summary once per local day instead of silently
  // dropping overdue events because their due time has passed.
  const outstanding = overdue.filter((event) =>
    event.status === "pending" && passesPriorityFilter(event.priority, settings.priorityFilter));
  if (outstanding.length && desired.size < MAX_REMINDERS) {
    const today = new Date(now);
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const key = `${userId}:overdue:${ymd}`;
    const decision = dailySummaryDecision(
      key, userPlan.lastOverdueKey, userPlan.entries, osPendingIds,
    );
    if (decision.keepPendingId !== null) {
      // This exact ID/key is still pending on Android. Its original time
      // remains inside the OS; no new schedule request will be issued.
      desired.set(decision.keepPendingId, { key, when: new Date(now + 2 * 60_000) });
    } else if (decision.shouldCreate) {
      const at = plannedReminderTime(new Date(now + 2 * 60_000).toISOString(), settings.quietHours, "normal");
      if (at && +at > now) {
        let id = nativeId(key);
        while (desired.has(id) && desired.get(id)?.key !== key) {
          id = id === 999_999_999 ? 600_000_000 : id + 1;
        }
        desired.set(id, { key, when: at });
        scheduledOverdueKey = key;
      }
    }
  }

  const { toSchedule: toCreate, toCancel } = compareNativeReminderState(
    userPlan.entries, desired, osPendingIds,
  );
  // Install new reminders before deleting old ones, so a plugin/scheduling
  // failure leaves previously scheduled reminders intact.
  if (toCreate.length) await LocalNotifications.schedule({
    notifications: toCreate.map(([id, entry]) => ({
      id, title: "تذكير مالي — رصد", body: "افتح رصد لمراجعة موعد استحقاق",
      schedule: { at: entry.when }, extra: { rasd: true },
    })),
  });
  // If a hashed ID was reused by a changed event, scheduling already
  // replaced it and the reconciliation planner does not cancel that ID.
  if (toCancel.length) await LocalNotifications.cancel({
    notifications: toCancel.map((id) => ({ id })),
  });
  savePlan({
    user: userId,
    entries: Object.fromEntries([...desired.entries()].map(([id, entry]) => [String(id), entry.key])),
    // Persist the date marker after successful OS scheduling. Otherwise the
    // reminder can fire, vanish from getPending, then be rescheduled at the
    // next 10-minute foreground sync (more than once per day).
    lastOverdueKey: scheduledOverdueKey ?? userPlan.lastOverdueKey,
  });
  return { scheduled: desired.size, permission: "granted" };
}

/**
 * The native plugin, persisted plan and remote events must not overlap.
 * In particular a slow sync may be in flight when the user logs out.
 * Logout will await that sync, then clear all of its resulting OS alarms.
 */
export function syncNativeReminders(
  userId: string,
  opts: { askPermission?: boolean } = {},
): Promise<{ scheduled: number; permission: string }> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve({ scheduled: 0, permission: "web" });
  const requestedAtEpoch = cancellationEpoch;
  return runSerialized(() =>
    requestedAtEpoch === cancellationEpoch
      ? syncNativeRemindersUnlocked(userId, opts)
      : Promise.resolve({ scheduled: 0, permission: "cancelled" }),
  );
}

export function clearNativeReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  // A slow sync already executing will finish before this queued clear.
  // Any earlier sync that has not started is discarded after this increment.
  cancellationEpoch += 1;
  return runSerialized(clearNativeRemindersUnlocked);
}
