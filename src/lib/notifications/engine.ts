// =============================================================
// Notification Delivery Engine
// -------------------------------------------------------------
// A thin layer on top of the existing read-only event aggregator
// (src/lib/events/engine.ts → computeUpcomingEvents, itself sourced from
// system_events + derived tables). This module:
//   1. Decides which due events are worth notifying about (priority filter,
//      quiet hours, per-channel dedupe).
//   2. Hands each one to the enabled NotificationProvider channel(s).
//   3. Records the outcome in the local notification log (store.ts).
//
// It never writes to system_events or any financial table, never creates
// a new event, and is only ever triggered from the client (a mount effect
// / interval / manual "check now" button) — no cron, no background worker.
// =============================================================
import { computeUpcomingEvents, EVENT_LABEL, type UpcomingEvent } from "@/lib/events/engine";
import {
  loadNotificationSettings,
  passesPriorityFilter,
  isWithinQuietHours,
  type NotificationChannel,
} from "./config";
import {
  createDefaultProviders,
  CHANNEL_METHOD,
  type NotificationProvider,
  type NotificationPayload,
} from "./provider";
import { hasBeenSent, recordNotification } from "./store";

export interface ProcessSummary {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  disabled: boolean;
}

function toPayload(ev: UpcomingEvent): NotificationPayload {
  return {
    id: ev.id,
    title: ev.title,
    body: ev.description || EVENT_LABEL[ev.event_type],
    priority: ev.priority,
    dueDate: ev.due_date,
    data: { entityType: ev.entity_type, entityId: ev.entity_id, eventType: ev.event_type },
  };
}

async function deliver(
  provider: NotificationProvider,
  channel: NotificationChannel,
  payload: NotificationPayload,
) {
  const method = provider[CHANNEL_METHOD[channel]] as (
    p: NotificationPayload,
  ) => ReturnType<NotificationProvider["sendPush"]>;
  return method.call(provider, payload);
}

/**
 * Scans due events (overdue + due today) and delivers a notification per
 * enabled channel, once per event+channel (dedupe via the local log).
 * Safe to call repeatedly (e.g. on an interval while the app is open) —
 * already-sent event/channel pairs are skipped, so nothing is re-sent.
 */
export async function processPendingNotifications(
  opts: { providers?: Record<NotificationChannel, NotificationProvider> } = {},
): Promise<ProcessSummary> {
  const settings = loadNotificationSettings();
  if (!settings.enabled) return { scanned: 0, sent: 0, skipped: 0, failed: 0, disabled: true };

  const providers = opts.providers ?? createDefaultProviders();
  const buckets = await computeUpcomingEvents({ horizonDays: 0 }); // overdue + due today only
  const due = [...buckets.overdue, ...buckets.today];

  const quiet = isWithinQuietHours(settings.quietHours);
  const enabledChannels = (Object.keys(settings.channels) as NotificationChannel[]).filter(
    (c) => settings.channels[c],
  );

  let sent = 0,
    skipped = 0,
    failed = 0;
  for (const ev of due) {
    if (!passesPriorityFilter(ev.priority, settings.priorityFilter)) {
      skipped++;
      continue;
    }
    const payload = toPayload(ev);

    for (const channel of enabledChannels) {
      if (hasBeenSent(ev.id, channel)) continue; // already delivered this event on this channel

      if (quiet && ev.priority !== "critical") {
        recordNotification({
          eventId: ev.id,
          channel,
          title: payload.title,
          body: payload.body,
          priority: ev.priority,
          dueDate: ev.due_date,
          status: "skipped",
          reason: "quiet_hours",
        });
        skipped++;
        continue;
      }

      const result = await deliver(providers[channel], channel, payload);
      recordNotification({
        eventId: ev.id,
        channel,
        title: payload.title,
        body: payload.body,
        priority: ev.priority,
        dueDate: ev.due_date,
        status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
        reason: result.reason,
        error: result.error,
      });
      if (result.ok) sent++;
      else if (result.skipped) skipped++;
      else failed++;
    }
  }

  return { scanned: due.length, sent, skipped, failed, disabled: false };
}
