// =============================================================
// AdProvider — abstract interface for future platform adapters.
// No implementation does anything real. Adapters will be plugged
// in later (Web via AdSense, Android/iOS via AdMob through Capacitor
// or React Native bridges).
// =============================================================
import type { AdPlacement } from "./ad-config";

export interface AdProvider {
  readonly name: "noop" | "web-adsense" | "android-admob" | "ios-admob";
  init(): Promise<void>;
  showBanner(placement: AdPlacement): Promise<void>;
  showInterstitial(placement: AdPlacement): Promise<void>;
  showReward(placement: AdPlacement): Promise<{ rewarded: boolean }>;
  hide(placement?: AdPlacement): Promise<void>;
}

export const NoopAdProvider: AdProvider = {
  name: "noop",
  async init() {},
  async showBanner() {},
  async showInterstitial() {},
  async showReward() { return { rewarded: false }; },
  async hide() {},
};

export function detectPlatform(): "web" | "android" | "ios" {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}
