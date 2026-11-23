import { parseNativeAuthCallback } from "./native-callback-url";
import { takePendingGoogleOAuth } from "./native-google-state";

/** Minimal Supabase auth interface, intentionally injectable for regressions. */
export interface NativeGoogleAuthGateway {
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  exchangeCodeForSession: (code: string) => Promise<{
    data: { user: { id: string } | null; session: { access_token: string } | null };
    error: unknown;
  }>;
}
export type NativeGoogleHandoffResult =
  | { kind: "ignored" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/** Never expose a provider code or bearer token to a UI message/log. */
export async function processNativeGoogleCallback(
  raw: string,
  storage: Pick<Storage, "getItem" | "removeItem">,
  auth: NativeGoogleAuthGateway,
  now = Date.now(),
): Promise<NativeGoogleHandoffResult> {
  const payload = parseNativeAuthCallback(raw);
  if (!payload) return { kind: "ignored" };
  if (!takePendingGoogleOAuth(storage, now)) {
    return { kind: "error", message: "رابط العودة غير مرتبط بمحاولة دخول حديثة من داخل رصد. أعد بدء تسجيل Google من التطبيق." };
  }
  if (payload.kind === "error") return { kind: "error", message: payload.message };
  try {
    const previous = await auth.getUser();
    if (!previous.error && previous.data.user)
      return { kind: "error", message: "يوجد حساب مسجّل بالفعل؛ لن يستبدله رصد تلقائيًا." };
    const exchanged = await auth.exchangeCodeForSession(payload.code);
    if (exchanged.error || !exchanged.data.session?.access_token || !exchanged.data.user?.id)
      return { kind: "error", message: "لم تنجح العودة الآمنة من Google. راجع إعدادات Supabase أو أعد المحاولة." };
    const verified = await auth.getUser();
    if (verified.error || verified.data.user?.id !== exchanged.data.user.id)
      return { kind: "error", message: "لم تتطابق هوية Google مع جلسة Supabase المؤكدة؛ لم يُسمح بفتح البيانات." };
    return { kind: "success" };
  } catch {
    return { kind: "error", message: "تعذر التحقق من جلسة Google على الجهاز. أعد بدء تسجيل الدخول." };
  }
}
