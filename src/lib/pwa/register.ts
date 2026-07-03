// =============================================================
// PART 3 (Prompt 24) — registerServiceWorker()
// -------------------------------------------------------------
// Registers public/sw.js for static-asset offline caching only. Safe to
// call unconditionally: no-ops when Service Worker isn't supported, and
// no-ops when running as a Capacitor native app (which has its own
// offline story via the local filesystem and doesn't need a web SW).
// =============================================================
import { isNative } from "@/lib/mobile/platform";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (isNative()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}
