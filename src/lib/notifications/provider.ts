// =============================================================
// NotificationProvider — abstract interface for delivery channels.
// -------------------------------------------------------------
// Mirrors src/lib/ads/ad-provider.ts: a single interface, a Noop base,
// and per-channel adapters. The engine (engine.ts) only ever talks to
// this interface, so a channel can go from stub → real vendor without
// touching the engine or the UI.
// =============================================================
import type { EventPriority } from "@/lib/events/engine";
import type { NotificationChannel } from "./config";

export interface NotificationPayload {
  id: string; // stable id of the source event (system_events row or derived id)
  title: string;
  body?: string;
  priority: EventPriority;
  dueDate: string; // ISO
  data?: Record<string, unknown>;
}

export interface NotificationSendResult {
  ok: boolean;
  channel: NotificationChannel;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

// One interface, all five delivery methods — a channel adapter only needs
// to give a real implementation for the method matching its own channel;
// the rest inherit the Noop behavior below.
export interface NotificationProvider {
  sendPush(payload: NotificationPayload): Promise<NotificationSendResult>;
  sendEmail(payload: NotificationPayload): Promise<NotificationSendResult>;
  sendSms(payload: NotificationPayload): Promise<NotificationSendResult>;
  sendWhatsApp(payload: NotificationPayload): Promise<NotificationSendResult>;
  scheduleLocal(payload: NotificationPayload): Promise<NotificationSendResult>;
}

function skip(channel: NotificationChannel, reason: string): NotificationSendResult {
  return { ok: false, channel, skipped: true, reason };
}

abstract class NoopNotificationProvider implements NotificationProvider {
  async sendPush(_payload: NotificationPayload): Promise<NotificationSendResult> {
    return skip("push", "provider_not_configured");
  }
  async sendEmail(_payload: NotificationPayload): Promise<NotificationSendResult> {
    return skip("email", "provider_not_configured");
  }
  async sendSms(_payload: NotificationPayload): Promise<NotificationSendResult> {
    return skip("sms", "provider_not_configured");
  }
  async sendWhatsApp(_payload: NotificationPayload): Promise<NotificationSendResult> {
    return skip("whatsapp", "provider_not_configured");
  }
  async scheduleLocal(_payload: NotificationPayload): Promise<NotificationSendResult> {
    return skip("local", "provider_not_configured");
  }
}

// ----- Stub adapters (no external SDK, no network call) -----
// Each stub only "handles" its own channel — logs the intent to the
// console and reports back `skipped`, so the engine still records a
// notification-log entry. Replace the body of the matching method with a
// real vendor call (FCM, SendGrid, Twilio, WhatsApp Business API, ...)
// when that channel is ready — nothing else in the app needs to change.

export class PushProviderStub extends NoopNotificationProvider {
  async sendPush(payload: NotificationPayload): Promise<NotificationSendResult> {
    console.info("[NotificationProvider:push:stub] would send", payload.title);
    return skip("push", "stub_not_wired");
  }
}

export class EmailProviderStub extends NoopNotificationProvider {
  async sendEmail(payload: NotificationPayload): Promise<NotificationSendResult> {
    console.info("[NotificationProvider:email:stub] would send", payload.title);
    return skip("email", "stub_not_wired");
  }
}

export class SmsProviderStub extends NoopNotificationProvider {
  async sendSms(payload: NotificationPayload): Promise<NotificationSendResult> {
    console.info("[NotificationProvider:sms:stub] would send", payload.title);
    return skip("sms", "stub_not_wired");
  }
}

export class WhatsAppProviderStub extends NoopNotificationProvider {
  async sendWhatsApp(payload: NotificationPayload): Promise<NotificationSendResult> {
    console.info("[NotificationProvider:whatsapp:stub] would send", payload.title);
    return skip("whatsapp", "stub_not_wired");
  }
}

// ----- Local adapter (real, no external SDK) -----
// Web: uses the browser Notification API directly.
// Native (Capacitor Android/iOS): looks up `Capacitor.Plugins.LocalNotifications`
// at runtime — no static import of `@capacitor/local-notifications`, so the
// build doesn't need that package installed. If/when it's added as a
// dependency (`bun add @capacitor/local-notifications`) and its side-effect
// import registers the plugin, this branch starts working with no code
// changes here.
export class LocalNotificationProvider extends NoopNotificationProvider {
  async scheduleLocal(payload: NotificationPayload): Promise<NotificationSendResult> {
    if (typeof window === "undefined") return skip("local", "no_window");

    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      const plugin = capacitor.Plugins?.LocalNotifications;
      if (!plugin?.schedule) {
        return skip("local", "capacitor_local_notifications_not_installed");
      }
      try {
        const perm = await plugin.checkPermissions?.();
        if (perm && perm.display !== "granted") {
          const req = await plugin.requestPermissions?.();
          if (req && req.display !== "granted") return skip("local", "permission_denied");
        }
        await plugin.schedule({
          notifications: [
            {
              id: hashToInt(payload.id),
              title: payload.title,
              body: payload.body ?? "",
              schedule: { at: new Date() },
              extra: payload.data ?? {},
            },
          ],
        });
        return { ok: true, channel: "local" };
      } catch (e: any) {
        return { ok: false, channel: "local", error: e?.message ?? "native_schedule_failed" };
      }
    }

    if (typeof Notification === "undefined") return skip("local", "unsupported_browser");
    try {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission !== "granted") return skip("local", "permission_denied");
      new Notification(payload.title, { body: payload.body, tag: payload.id });
      return { ok: true, channel: "local" };
    } catch (e: any) {
      return { ok: false, channel: "local", error: e?.message ?? "web_notification_failed" };
    }
  }
}

function hashToInt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

export const CHANNEL_METHOD: Record<NotificationChannel, keyof NotificationProvider> = {
  push: "sendPush",
  email: "sendEmail",
  sms: "sendSms",
  whatsapp: "sendWhatsApp",
  local: "scheduleLocal",
};

export function createDefaultProviders(): Record<NotificationChannel, NotificationProvider> {
  return {
    push: new PushProviderStub(),
    email: new EmailProviderStub(),
    sms: new SmsProviderStub(),
    whatsapp: new WhatsAppProviderStub(),
    local: new LocalNotificationProvider(),
  };
}
