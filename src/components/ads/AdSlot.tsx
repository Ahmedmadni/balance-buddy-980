// =============================================================
// AdSlot — single reusable placeholder component.
// Renders nothing real. When ads are enabled in the future, this
// is the ONLY component that needs to grow a real implementation.
// =============================================================
import { Megaphone } from "lucide-react";
import { useAds } from "@/lib/ads/ad-context";
import {
  PLACEMENT_FORMAT, WEB_ADSENSE_SLOTS, ANDROID_ADMOB_UNITS, IOS_ADMOB_UNITS,
  type AdPlacement, type AdPlatform,
} from "@/lib/ads/ad-config";
import { evaluateAdVisibility } from "@/lib/ads/rules";
import { cn } from "@/lib/utils";

type Props = {
  slot: AdPlacement;
  platform?: AdPlatform;     // default "auto"
  enabled?: boolean;         // override (still gated by global prefs)
  className?: string;
};

const FORMAT_HEIGHT: Record<string, string> = {
  banner: "h-20",
  rectangle: "h-40",
  native: "h-24",
  interstitial: "h-0",
  reward: "h-0",
};

export function AdSlot({ slot, platform = "auto", enabled = true, className }: Props) {
  const { prefs, platform: detected } = useAds();
  const active: AdPlatform = platform === "auto" ? detected : platform;

  const visibility = evaluateAdVisibility({ placement: slot, prefs, platform: active, placementEnabled: enabled });
  if (!visibility.visible) return null;

  const format = PLACEMENT_FORMAT[slot];
  const slotId =
    active === "android" ? ANDROID_ADMOB_UNITS[slot] :
    active === "ios" ? IOS_ADMOB_UNITS[slot] :
    WEB_ADSENSE_SLOTS[slot];

  return (
    <div
      data-ad-slot={slot}
      data-ad-platform={active}
      data-ad-id={slotId}
      data-ad-format={format}
      aria-hidden="true"
      className={cn(
        "w-full rounded-2xl border border-dashed bg-muted/30 text-muted-foreground",
        "flex items-center justify-center gap-2 text-xs select-none",
        FORMAT_HEIGHT[format] || "h-20",
        className,
      )}
    >
      <Megaphone className="h-4 w-4 opacity-60" />
      <span className="font-medium opacity-70">مساحة إعلانية</span>
      <span className="opacity-50">· {slot} · {active}</span>
      {prefs.testMode && <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px]">TEST</span>}
    </div>
  );
}
