import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { parseNativeAuthCallback } from "./native-callback-url";
import { NATIVE_GOOGLE_UNAVAILABLE } from "./google-sign-in-flow";

/** Mount once at application root; handles an already-running or cold-started Android activity. */
export async function listenForNativeOAuth(opts: {
  onFailure: (message: string) => void;
}): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  let disposed = false;
  let notified = false;
  const receive = (raw: string) => {
    const payload = parseNativeAuthCallback(raw);
    if (!payload || disposed || notified) return;
    notified = true;
    // This build initiates no native PKCE transaction. Reject even a well-formed
    // code from an old APK or unsolicited deep link; never replace an existing account.
    opts.onFailure(NATIVE_GOOGLE_UNAVAILABLE);
  };
  const handle = await App.addListener("appUrlOpen", ({ url }) => { void receive(url); });
  try {
    const initial = await App.getLaunchUrl();
    if (initial?.url) void receive(initial.url);
  } catch { /* cold launch URL unavailable on some devices */ }
  return () => { disposed = true; void handle.remove(); };
}
