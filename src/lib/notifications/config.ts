// =============================================================
// Notification Engine — Central Configuration
// -------------------------------------------------------------
// User-facing delivery preferences, stored locally (no schema changes —
// mirrors the pattern used by src/lib/events/engine.ts ReminderPrefs and
// src/lib/ads/ad-config.ts AdPrefs). Nothing here talks to Supabase.
// =============================================================
import type { EventPriority } from "@/lib/events/engine";

export type NotificationChannel = "push" | "email" | "sms" | "whatsapp" | "local";

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  push: "إشعارات Push",
  email: "البريد الإلكتروني",
  sms: "رسائل SMS",
  whatsapp: "واتساب",
  local: "إشعارات محلية على الجهاز",
};

export const CHANNEL_AVAILABLE: Record<NotificationChannel, boolean> = {
  // Only "local" has a real implementation today (Web Notifications API).
  // The rest are wired end-to-end but backed by stub providers until a
  // real vendor (FCM/SendGrid/Twilio/WhatsApp Business API/...) is connected.
  push: false,
  email: false,
  sms: false,
  whatsapp: false,
  local: true,
};

export interface QuietHours {
  enabled: boolean;
  start: string; // "HH:MM", 24h
  end: string; // "HH:MM", 24h — may wrap past midnight (start > end)
}

export interface NotificationSettings {
  enabled: boolean;
  channels: Record<NotificationChannel, boolean>;
  quietHours: QuietHours;
  priorityFilter: EventPriority; // minimum priority that triggers a notification
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false, // opt-in: avoids surprising permission prompts / stub noise
  channels: { push: false, email: false, sms: false, whatsapp: false, local: true },
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  priorityFilter: "low", // "low" = notify on every priority
};

const SETTINGS_KEY = "rasd.notificationSettings.v1";

export function loadNotificationSettings(): NotificationSettings {
  if (typeof localStorage === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...raw,
      channels: { ...DEFAULT_NOTIFICATION_SETTINGS.channels, ...(raw.channels || {}) },
      quietHours: { ...DEFAULT_NOTIFICATION_SETTINGS.quietHours, ...(raw.quietHours || {}) },
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(s: NotificationSettings) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

const PRIORITY_RANK: Record<EventPriority, number> = { low: 0, normal: 1, high: 2, critical: 3 };

export function passesPriorityFilter(priority: EventPriority, minPriority: EventPriority): boolean {
  return PRIORITY_RANK[priority] >= PRIORITY_RANK[minPriority];
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

/** True if `at` (default: now) falls inside the configured quiet-hours window. Handles overnight wrap. */
export function isWithinQuietHours(quietHours: QuietHours, at: Date = new Date()): boolean {
  if (!quietHours.enabled) return false;
  const cur = at.getHours() * 60 + at.getMinutes();
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // wraps past midnight
}
