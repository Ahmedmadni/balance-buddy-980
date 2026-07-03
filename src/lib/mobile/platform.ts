// =============================================================
// Capacitor Integration Layer — platform detection.
// -------------------------------------------------------------
// Reads `window.Capacitor` at runtime (injected by the native shell when
// running inside a real Capacitor app — no static import of
// @capacitor/core needed, same "no build-time dependency" technique
// used in src/lib/notifications/provider.ts for LocalNotifications).
// Falls back to the existing UA-sniffing detectPlatform() from
// src/lib/ads/ad-provider.ts for plain web/preview contexts, instead of
// re-implementing platform sniffing a second time.
// =============================================================
import { detectPlatform } from "@/lib/ads/ad-provider";

export type Platform = "android" | "ios" | "web";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, any>;
}

function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNative(): boolean {
  return !!getCapacitor()?.isNativePlatform?.();
}

export function isWeb(): boolean {
  return !isNative();
}

export function getPlatform(): Platform {
  const cap = getCapacitor();
  const native = cap?.getPlatform?.();
  if (native === "android" || native === "ios") return native;
  const webGuess = detectPlatform(); // "web" | "android" | "ios" — UA-based fallback
  return webGuess === "android" || webGuess === "ios" ? webGuess : "web";
}

export function isAndroid(): boolean {
  return getPlatform() === "android";
}

export function isIOS(): boolean {
  return getPlatform() === "ios";
}

/** Look up a Capacitor plugin by name without a static import (see notifications/provider.ts). */
export function getCapacitorPlugin(name: string): any | undefined {
  return getCapacitor()?.Plugins?.[name];
}
