import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { parseNativeAuthCallback, NATIVE_AUTH_CALLBACK } from "./native-callback-url";
import {
  clearPendingGoogleOAuth,
  nativeGoogleProviderReady,
  recordPendingGoogleOAuth,
  takePendingGoogleOAuth,
  validNativeGoogleAuthorizeUrl,
} from "./native-google-state";

/**
 * Android must perform PKCE inside the original hosted WebView so its
 * code_verifier survives while Google runs in an external system browser.
 * The callback contains ONLY a short-lived code, never access/refresh tokens.
 *
 * Direct Supabase Google OAuth requires an administrator to configure the
 * provider credentials and allowlist this exact deep link. The public
 * deployment flag blocks the previously witnessed HTTP 400 if not configured.
 */
export const NATIVE_GOOGLE_SETUP_REQUIRED =
  "يلزم إكمال إعداد تسجيل Google لتطبيق رصد: تفعيل Google OAuth في Supabase، وإضافة رابط العودة للتطبيق، ثم تفعيل إصدار Android. لن تُفتح صفحة الخطأ السابقة.";

export type NativeGoogleStartResult =
  | { kind: "opened" }
  | { kind: "authenticated" }
  | { kind: "error"; message: string };

export function nativeGoogleReady(): boolean {
  return nativeGoogleProviderReady(import.meta.env.VITE_RASD_NATIVE_GOOGLE_OAUTH_READY);
}

export async function startNativeGoogleSignIn(): Promise<NativeGoogleStartResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android")
    return { kind: "error", message: "هذه الطريقة مخصصة لتطبيق رصد على Android." };
  if (!nativeGoogleReady())
    return { kind: "error", message: NATIVE_GOOGLE_SETUP_REQUIRED };

  try {
    const authenticated = await supabase.auth.getUser();
    if (!authenticated.error && authenticated.data.user)
      return { kind: "authenticated" };

    // Supabase JS persists the PKCE verifier in this WebView's auth.storage.
    // skipBrowserRedirect avoids sending the embedded WebView to Google.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true },
    });
    if (error) {
      return { kind: "error", message: "تعذر بدء Google من خادم رصد. تحقق من إعداد المزوّد وحاول مرة أخرى." };
    }
    const authorizeUrl = validNativeGoogleAuthorizeUrl(
      data.url, supabase.supabaseUrl, NATIVE_AUTH_CALLBACK,
    );
    if (!authorizeUrl) {
      return { kind: "error", message: "رفض رصد رابط Google غير مطابق لخادم المصادقة المعتمد." };
    }
    if (!recordPendingGoogleOAuth(localStorage)) {
      return { kind: "error", message: "تعذر حفظ طلب الدخول الآمن على الجهاز. تأكد من سماح الهاتف بالتخزين المحلي." };
    }
    try {
      await Browser.open({ url: authorizeUrl });
    } catch {
      clearPendingGoogleOAuth(localStorage);
      return { kind: "error", message: "تعذر فتح متصفح Google الآمن على الهاتف." };
    }
    return { kind: "opened" };
  } catch {
    return { kind: "error", message: "تعذر بدء تسجيل Google. تحقق من الإنترنت والإعدادات ثم حاول مرة أخرى." };
  }
}

/** Mount once at root. Accept callbacks after warm resume and cold Android launch. */
export async function listenForNativeOAuth(opts: {
  onFailure: (message: string) => void;
  onSuccess: () => void;
}): Promise<() => void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return () => {};
  let disposed = false;
  let processing = false;
  const receive = async (raw: string) => {
    const payload = parseNativeAuthCallback(raw);
    if (!payload || processing || disposed) return;
    processing = true;
    try {
      // This guard is one-time and time-limited, in addition to Supabase PKCE.
      // Unsolicited app:// links must never replace an existing user's session.
      if (!takePendingGoogleOAuth(localStorage)) {
        opts.onFailure("رابط العودة غير مرتبط بمحاولة دخول حديثة من داخل رصد. افتح التطبيق وابدأ تسجيل Google من جديد.");
        return;
      }
      if (payload.kind === "error") {
        opts.onFailure(payload.message);
        return;
      }
      const current = await supabase.auth.getUser();
      if (!current.error && current.data.user) {
        opts.onFailure("يوجد حساب مسجّل بالفعل. لن يُستبدل الحساب الحالي تلقائيًا.");
        return;
      }
      // PKCE verifier belongs to the SAME WebView that started OAuth, not
      // the external browser. A mismatched/replayed code cannot create a session.
      const { data, error } = await supabase.auth.exchangeCodeForSession(payload.code);
      if (error || !data.session?.access_token || !data.user?.id) {
        opts.onFailure("تعذر إكمال العودة الآمنة من Google. تحقق من إعداد OAuth ورابط العودة ثم أعد المحاولة.");
        return;
      }
      const checked = await supabase.auth.getUser();
      if (checked.error || checked.data.user?.id !== data.user.id) {
        // Never navigate into finance records with an unverified account.
        opts.onFailure("تم رفض جلسة Google لأنها لم تتطابق مع هوية المستخدم المؤكدة.");
        return;
      }
      opts.onSuccess();
    } catch {
      opts.onFailure("تعذر التحقق من جلسة Google على الجهاز. أعد بدء تسجيل الدخول.");
    } finally {
      processing = false;
      try { await Browser.close(); } catch { /* external browser already closed */ }
    }
  };
  const listener = await App.addListener("appUrlOpen", ({ url }) => { void receive(url); });
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) void receive(launch.url);
  } catch { /* getLaunchUrl is unavailable on some devices */ }
  return () => { disposed = true; void listener.remove(); };
}
