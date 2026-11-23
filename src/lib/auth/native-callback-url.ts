/** Dedicated native callback: never accept an arbitrary web URL as a login handoff. */
export const NATIVE_AUTH_CALLBACK = "app.lovable.rasd://auth/callback";

export type NativeCallback =
  | { kind: "code"; code: string }
  | { kind: "error"; message: string };

export function parseNativeAuthCallback(raw: string): NativeCallback | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "app.lovable.rasd:" || url.hostname !== "auth" || url.pathname !== "/callback" || url.username || url.password || url.port) return null;
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (["access_token", "refresh_token", "id_token"].some(key => query.has(key) || fragment.has(key))) {
    return { kind: "error", message: "رابط العودة غير آمن؛ لم يتم قبول بيانات الجلسة." };
  }
  const error = query.has("error_description") || fragment.has("error_description") || query.has("error") || fragment.has("error");
  if (error) return { kind: "error", message: "لم يكتمل تسجيل الدخول." };
  const code = query.get("code");
  if (code && query.getAll("code").length === 1 && !url.hash) return { kind: "code", code };
  return { kind: "error", message: "لم تصل بيانات تسجيل الدخول من المتصفح" };
}
