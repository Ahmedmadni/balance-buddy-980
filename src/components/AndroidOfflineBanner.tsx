import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { WifiOff } from "lucide-react";

/** Connectivity indicator, not a promise of offline transactions. */
export function AndroidOfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const refresh = () => setOffline(!navigator.onLine);
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-[80] flex items-center justify-center gap-2 border-b border-warning/40 bg-background px-3 py-2 text-center text-xs text-foreground">
      <WifiOff className="h-4 w-4 shrink-0" />
      لا يوجد اتصال بالإنترنت. لا تدخل عمليات مالية جديدة حتى يعود الاتصال.
    </div>
  );
}
