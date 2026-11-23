// The broker's LovableApp iframe bridge is not a public Capacitor PKCE API.
// Fail closed until a documented, device-verified native handoff is available.
export const NATIVE_GOOGLE_UNAVAILABLE = "تسجيل جوجل داخل تطبيق أندرويد غير متاح حالياً: إعداد الدخول والعودة الآمنة إلى التطبيق لم يكتمل. حسابك وبياناتك محفوظان؛ لا تنشئ حساباً جديداً. يمكنك الدخول إلى حسابك الحالي من موقع رصد في المتصفح.";

export type GoogleSignInResult =
  | { kind: "authenticated" }
  | { kind: "redirected" }
  | { kind: "error"; message: string };

export function googleSignInError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/unsupported provider|missing oauth secret/i.test(message)) {
    return "إعداد تسجيل جوجل غير مكتمل لدى رصد. حسابك محفوظ؛ حاول لاحقاً ولا تنشئ حساباً جديداً.";
  }
  if (/cancel|access_denied|denied/i.test(message)) return "أُلغي تسجيل الدخول. يمكنك المحاولة مرة أخرى.";
  return "تعذّر إكمال تسجيل الدخول. تحقق من اتصالك وحاول مرة أخرى.";
}

export async function runGoogleSignIn(native: boolean, dependencies: {
  managedSignIn: () => Promise<{ error?: unknown; redirected?: boolean }>;
  verifyUser: () => Promise<boolean>;
}): Promise<GoogleSignInResult> {
  // No browser, provider request, token exchange, or account creation on Android.
  if (native) return { kind: "error", message: NATIVE_GOOGLE_UNAVAILABLE };
  try {
    const result = await dependencies.managedSignIn();
    if (result.error) return { kind: "error", message: googleSignInError(result.error) };
    if (result.redirected) return { kind: "redirected" };
    if (!await dependencies.verifyUser()) {
      return { kind: "error", message: "لم تصل جلسة تسجيل الدخول بعد. حاول مرة أخرى." };
    }
    return { kind: "authenticated" };
  } catch (error) {
    return { kind: "error", message: googleSignInError(error) };
  }
}