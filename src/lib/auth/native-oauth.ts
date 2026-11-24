import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { NATIVE_AUTH_CALLBACK } from "./native-callback-url";
import { processNativeGoogleCallback } from "./native-google-handoff";
import {
  clearPendingGoogleOAuth,
  nativeGoogleProviderReady,
  recordPendingGoogleOAuth,
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
    // Local session is authoritative for preventing account replacement even
    // if the network is offline and getUser cannot validate it yet.
    const local = await supabase.auth.getSession();
    if (local.error)
      return { kind: "error", message: "تعذر فحص الجلسة الحالية. أعد المحاولة بعد استقرار الاتصال." };
    const authenticated = await supabase.auth.getUser();
    if (authenticated.error)
      return { kind: "error", message: "تعذر التحقق من الحساب الحالي. أعد المحاولة بعد استقرار الاتصال." };
    if (local.data.session?.access_token && !authenticated.data.user)
      return { kind: "error", message: "توجد جلسة محفوظة غير مؤكدة. لا يمكن استبدال الحساب أو فتح البيانات قبل التحقق منه." };
    if (authenticated.data.user)
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
    // SupabaseClient.supabaseUrl is a protected internal property; use the
    // same public Vite environment URL that initializes the existing client.
    const configuredAuthOrigin = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const authorizeUrl = configuredAuthOrigin
      ? validNativeGoogleAuthorizeUrl(data.url, configuredAuthOrigin, NATIVE_AUTH_CALLBACK)
      : null;
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
    if (processing || disposed) return;
    processing = true;
    try {
      const outcome = await processNativeGoogleCallback(raw, localStorage, {
        getSession: () => supabase.auth.getSession(),
        getUser: () => supabase.auth.getUser(),
        exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
        signOutLocal: () => supabase.auth.signOut({ scope: "local" }),
      });
      if (disposed) return;
      if (outcome.kind === "success") opts.onSuccess();
      else if (outcome.kind === "error") opts.onFailure(outcome.message);
    } finally {
      processing = false;
      try { await Browser.close(); } catch { /* browser already closed */ }
    }
  };
  const listener = await App.addListener("appUrlOpen", ({ url }) => { void receive(url); });
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) void receive(launch.url);
  } catch { /* getLaunchUrl is unavailable on some devices */ }
  return () => { disposed = true; void listener.remove(); };
}
