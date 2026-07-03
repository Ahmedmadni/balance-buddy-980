// =============================================================
// PART 4 — Screenshots checklist
// -------------------------------------------------------------
// Thin re-export/adapter over release/store-assets.ts's screenshot
// items rather than re-deriving readiness — that module already checks
// the repo for actual screenshot files. This module only adds the
// required-size breakdown (documentation, not a live check — this
// sandbox has no way to inspect image dimensions of files that don't
// exist yet).
// =============================================================
import { generateStoreAssetsChecklist } from "@/lib/release/store-assets";

export interface ScreenshotSizeRequirement {
  id: string;
  label: string;
  required: boolean;
}

export interface ScreenshotRequirements {
  platform: "android" | "ios";
  haveAny: boolean;
  sizes: ScreenshotSizeRequirement[];
}

export interface ScreenshotsReport {
  android: ScreenshotRequirements;
  ios: ScreenshotRequirements;
  generatedAt: string;
}

export function generateScreenshotsReport(): ScreenshotsReport {
  const assets = generateStoreAssetsChecklist();
  const androidHave = assets.android.items.find((i) => i.id === "screenshots")?.status === "ready";
  const iosHave = assets.ios.items.find((i) => i.id === "screenshots")?.status === "ready";

  return {
    android: {
      platform: "android",
      haveAny: androidHave,
      sizes: [
        { id: "phone", label: "هاتف (16:9 أو 9:16)", required: true },
        { id: "seven_inch_tablet", label: "جهاز لوحي 7 بوصة", required: false },
        { id: "ten_inch_tablet", label: "جهاز لوحي 10 بوصة", required: false },
      ],
    },
    ios: {
      platform: "ios",
      haveAny: iosHave,
      sizes: [
        { id: "iphone_6_7", label: 'iPhone 6.7" (1290×2796)', required: true },
        { id: "iphone_6_5", label: 'iPhone 6.5" (1242×2688)', required: true },
        { id: "ipad_12_9", label: 'iPad 12.9" (2048×2732)', required: true },
      ],
    },
    generatedAt: new Date().toISOString(),
  };
}
