// =============================================================
// AdContext — exposes preferences + active provider to the tree.
// =============================================================
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AD_PREFS_KEY, DEFAULT_AD_PREFS, loadAdPrefs, type AdPrefs } from "./ad-config";
import { NoopAdProvider, detectPlatform, type AdProvider } from "./ad-provider";

type AdCtx = {
  prefs: AdPrefs;
  setPrefs: (p: Partial<AdPrefs>) => void;
  provider: AdProvider;
  platform: "web" | "android" | "ios";
};

const Ctx = createContext<AdCtx | null>(null);

export function AdProviderRoot({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<AdPrefs>(() => loadAdPrefs());
  const platform = useMemo(detectPlatform, []);

  useEffect(() => {
    try { localStorage.setItem(AD_PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  const value = useMemo<AdCtx>(() => ({
    prefs,
    setPrefs: (p) => setPrefsState((prev) => ({ ...prev, ...p })),
    provider: NoopAdProvider, // future: select per platform
    platform,
  }), [prefs, platform]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAds(): AdCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback when used outside provider (e.g., isolated render)
    return {
      prefs: DEFAULT_AD_PREFS,
      setPrefs: () => {},
      provider: NoopAdProvider,
      platform: detectPlatform(),
    };
  }
  return v;
}
