/** Dedicated native callback: never accept an arbitrary web URL as a login handoff. */
export const NATIVE_AUTH_CALLBACK = "app.lovable.rasd://auth/callback";

export type NativeCallback =
  | { kind: "code"; code: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string };

export function parseNativeAuthCallback(raw: string): NativeCallback | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "app.lovable.rasd:" || url.hostname !== "auth" || url.pathname !== "/callback") return null;
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const error = query.get("error_description") || fragment.get("error_description") || query.get("error") || fragment.get("error");
  if (error) return { kind: "error", message: error.slice(0, 300) };
  const code = query.get("code");
  if (code) return { kind: "code", code };
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "tokens", accessToken, refreshToken };
  return { kind: "error", message: "لم تصل بيانات تسجيل الدخول من المتصفح" };
}
