// Observed on the published origin on 2026-11-23; not a documented platform contract.
// Keep this URL-only workaround scoped to Android. Never hide/remove badge DOM or CSS.
export function androidBadgeUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Android hosting requires credential-free HTTPS");
  }
  url.searchParams.set("forceHideBadge", "true");
  return url.href;
}

/** Reapply after a hard reload of a nested page; no changes to ordinary browsers. */
export function androidBadgeReloadUrl(raw: string, nativeAndroid: boolean): string | null {
  if (!nativeAndroid) return null;
  try {
    const url = new URL(raw);
    // Never retransmit OAuth credentials/fragments just to alter badge visibility.
    if (url.hash || ["code", "access_token", "refresh_token", "error", "error_description"].some(key => url.searchParams.has(key))) return null;
    if (url.searchParams.get("forceHideBadge") === "true") return null;
    return androidBadgeUrl(raw);
  } catch { return null; }
}
/** Open the public login route directly so the site's root redirect cannot drop the badge flag. */
export function androidHostedLoginEntryUrl(raw: string): string {
  const url = new URL("/auth", raw);
  return androidBadgeUrl(url.href);
}
