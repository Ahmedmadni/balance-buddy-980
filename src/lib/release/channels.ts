// =============================================================
// PART 6 — Release Channels
// -------------------------------------------------------------
// A local, operator-set label for which release stage this build/
// device is considered to be in. The default is derived from a real
// signal (Vite's own import.meta.env.DEV) rather than guessed.
// =============================================================
import type { HealthStatus } from "@/lib/system/health";

export type ReleaseChannel =
  | "development"
  | "internal"
  | "closed_beta"
  | "open_beta"
  | "production";

const KEY = "rasd.releaseChannel.v1";

const VALID_CHANNELS: ReleaseChannel[] = [
  "development",
  "internal",
  "closed_beta",
  "open_beta",
  "production",
];

export const RELEASE_CHANNEL_LABEL: Record<ReleaseChannel, string> = {
  development: "Development",
  internal: "Internal",
  closed_beta: "Closed Beta",
  open_beta: "Open Beta",
  production: "Production",
};

function defaultChannel(): ReleaseChannel {
  return import.meta.env?.DEV ? "development" : "production";
}

export function getCurrentReleaseChannel(): ReleaseChannel {
  if (typeof localStorage === "undefined") return defaultChannel();
  try {
    const raw = localStorage.getItem(KEY);
    return raw && VALID_CHANNELS.includes(raw as ReleaseChannel)
      ? (raw as ReleaseChannel)
      : defaultChannel();
  } catch {
    return defaultChannel();
  }
}

export function setReleaseChannel(channel: ReleaseChannel): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, channel);
  } catch {
    /* quota — best effort */
  }
}

export interface ReleaseChannelAuditReport {
  channel: ReleaseChannel;
  isProduction: boolean;
  status: HealthStatus;
  detail: string;
  generatedAt: string;
}

export function auditReleaseChannel(): ReleaseChannelAuditReport {
  const channel = getCurrentReleaseChannel();
  const isProduction = channel === "production";
  return {
    channel,
    isProduction,
    status: isProduction ? "ok" : "warning",
    detail: isProduction
      ? "القناة الحالية: Production"
      : `القناة الحالية: ${RELEASE_CHANNEL_LABEL[channel]} — ليست جاهزة للجمهور العام بعد`,
    generatedAt: new Date().toISOString(),
  };
}
