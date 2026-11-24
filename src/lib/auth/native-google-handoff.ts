import { parseNativeAuthCallback } from "./native-callback-url";
import { takePendingGoogleOAuth } from "./native-google-state";
import {
  beginNativeGoogleQuarantine,
  clearNativeGoogleQuarantine,
  hasNativeGoogleQuarantine,
  isNativeGoogleQuarantinedOnDevice,
} from "./native-google-quarantine";

/** Minimal, injectable Supabase auth interface for native PKCE regressions. */
export interface NativeGoogleAuthGateway {
  getSession: () => Promise<{
    data: { session: { access_token: string } | null };
    error: unknown;
  }>;
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  exchangeCodeForSession: (code: string) => Promise<{
    data: { user: { id: string } | null; session: { access_token: string } | null };
    error: unknown;
  }>;
  /** Local only: a failed verification must not leave issued tokens on device. */
  signOutLocal: () => Promise<{ error: unknown }>;
}
export type NativeGoogleHandoffResult =
  | { kind: "ignored" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/**
 * Supabase exchangeCodeForSession installs its session and emits SIGNED_IN
 * BEFORE its caller can validate the server's user identity. Gate all protected
 * route transitions while validation and any necessary local rollback are running.
 */
let verifyingSessions = 0;
export function isNativeGoogleSessionVerificationInProgress(): boolean {
  return verifyingSessions > 0 || isNativeGoogleQuarantinedOnDevice();
}

const blocked = (message: string): NativeGoogleHandoffResult => ({ kind: "error", message });
const retryMessage = "تعذر التحقق من جلسة Google على الجهاز. أعد بدء تسجيل الدخول.";

/** Do not allow a rejected callback to leave freshly received credentials cached. */
async function discardNewSession(auth: NativeGoogleAuthGateway): Promise<boolean> {
  try {
    const result = await auth.signOutLocal();
    return !result.error;
  } catch {
    return false;
  }
}

/** Never expose an OAuth code, bearer token, or provider error detail to the UI/log. */
export async function processNativeGoogleCallback(
  raw: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  auth: NativeGoogleAuthGateway,
  now = Date.now(),
): Promise<NativeGoogleHandoffResult> {
  const payload = parseNativeAuthCallback(raw);
  if (!payload) return { kind: "ignored" };
  if (!takePendingGoogleOAuth(storage, now)) {
    return blocked("رابط العودة غير مرتبط بمحاولة دخول حديثة من داخل رصد. أعد بدء تسجيل Google من التطبيق.");
  }
  if (payload.kind === "error") return blocked(payload.message);
  if (hasNativeGoogleQuarantine(storage))
    return blocked("توجد جلسة Google سابقة غير مؤكدة. أصلح الجلسة قبل بدء محاولة جديدة.");

  // No new session is accepted if a different (or unverified) local session
  // already exists. Never replace the owner of financial cache and records.
  try {
    const existing = await auth.getSession();
    if (existing.error)
      return blocked("تعذر فحص الجلسة الحالية. أعد المحاولة عند استقرار الاتصال.");
    if (existing.data.session?.access_token)
      return blocked("توجد جلسة محفوظة بالفعل. لن يُستبدل الحساب الحالي تلقائيًا.");

    const previous = await auth.getUser();
    if (previous.error)
      return blocked("تعذر التحقق من الحساب الحالي. لن يتم تسجيل دخول جديد الآن.");
    if (previous.data.user)
      return blocked("يوجد حساب مسجّل بالفعل؛ لن يستبدله رصد تلقائيًا.");
  } catch {
    return blocked("تعذر فحص الجلسة الحالية. لن يتم استبدال أي حساب.");
  }

  // This durable marker must be written before Supabase can persist any
  // credentials. If WebView crashes during exchange, protected routes remain
  // blocked on the next launch, even when its auth session was cached.
  if (!beginNativeGoogleQuarantine(storage))
    return blocked("تعذر تأمين جلسة Google على الجهاز؛ لا يمكن إكمال الدخول بأمان.");

  verifyingSessions++;
  let verified = false;
  try {
    // This call uses the verifier in the SAME WebView that initiated sign-in.
    // Keep guarded routes closed until the subsequent getUser succeeds.
    const exchanged = await auth.exchangeCodeForSession(payload.code);
    if (exchanged.error || !exchanged.data.session?.access_token || !exchanged.data.user?.id)
      return blocked("لم تنجح العودة الآمنة من Google. راجع إعدادات Supabase أو أعد المحاولة.");
    const confirmed = await auth.getUser();
    if (confirmed.error || confirmed.data.user?.id !== exchanged.data.user.id)
      return blocked("لم تتطابق هوية Google مع جلسة Supabase المؤكدة؛ لم يُسمح بفتح البيانات.");
    // Do not leave the user signed in if the recovery marker cannot be
    // reliably removed. The finally path will sign out the new local session.
    if (!clearNativeGoogleQuarantine(storage))
      return blocked("تعذر إغلاق فحص أمان الجلسة. أعد المحاولة بعد إصلاح التخزين.");
    verified = true;
    return { kind: "success" };
  } catch {
    return blocked(retryMessage);
  } finally {
    if (!verified) {
      // Even a thrown exchange may have persisted tokens before failing.
      // Always attempt local rollback; only its confirmed success can release
      // the quarantine. A failed rollback keeps routes blocked after restart.
      const signedOut = await discardNewSession(auth);
      if (signedOut) clearNativeGoogleQuarantine(storage);
    }
    verifyingSessions--;
  }
}
