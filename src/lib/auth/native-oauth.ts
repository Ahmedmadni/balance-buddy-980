import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { NATIVE_AUTH_CALLBACK, parseNativeAuthCallback } from "./native-callback-url";

export async function startNativeGoogleSignIn(): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error("تسجيل الدخول الأصلي متاح داخل التطبيق فقط");
  // PKCE verifier stays in this WebView; only the one-time auth code returns via Android deep link.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("تعذر بدء مصادقة Google");
  await Browser.open({ url: data.url });
}

/** Mount once at application root; handles an already-running or cold-started Android activity. */
export async function listenForNativeOAuth(opts: {
  onSuccess: () => void;
  onFailure: (message: string) => void;
}): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  let disposed = false;
  let lastUrl = "";
  const receive = async (raw: string) => {
    const payload = parseNativeAuthCallback(raw);
    if (!payload || disposed || lastUrl === raw) return;
    lastUrl = raw;
    try {
      if (payload.kind === "error") throw new Error(payload.message);
      const result = payload.kind === "code"
        ? await supabase.auth.exchangeCodeForSession(payload.code)
        : await supabase.auth.setSession({
            access_token: payload.accessToken,
            refresh_token: payload.refreshToken,
          });
      if (result.error || !result.data?.session) {
        throw result.error ?? new Error("لم يتم إنشاء جلسة المستخدم");
      }
      if (!disposed) opts.onSuccess();
    } catch {
      // Do not expose OAuth codes/tokens or provider error internals in the UI.
      if (!disposed) opts.onFailure("لم يكتمل الدخول. تأكد من إعداد رابط العودة ثم حاول مرة أخرى.");
    } finally {
      // On Android the deep link returns to the activity automatically. Avoid Browser.close()
      // which can reopen a Custom Tab on some Capacitor 8 Android versions.
      if (Capacitor.getPlatform() === "ios") void Browser.close().catch(() => {});
    }
  };
  const handle = await App.addListener("appUrlOpen", ({ url }) => { void receive(url); });
  try {
    const initial = await App.getLaunchUrl();
    if (initial?.url) void receive(initial.url);
  } catch { /* cold launch URL unavailable on some devices */ }
  return () => { disposed = true; void handle.remove(); };
}
