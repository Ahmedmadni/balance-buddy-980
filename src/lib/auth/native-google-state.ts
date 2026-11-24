/**
 * Presence/age guard for one external-browser Google OAuth request.
 *
 * The real PKCE verifier is owned and stored by Supabase JS in the SAME
 * WebView origin. Never put that verifier, tokens, or auth codes in this marker.
 */
export const NATIVE_GOOGLE_PENDING_KEY = "rasd-native-google-pkce-pending-v1";
export const NATIVE_GOOGLE_TIMEOUT_MS = 10 * 60 * 1000;

export interface PendingGoogleOAuth { createdAt: number; }

export function recordPendingGoogleOAuth(storage: Pick<Storage, "setItem">, now = Date.now()): boolean {
  try {
    storage.setItem(NATIVE_GOOGLE_PENDING_KEY, JSON.stringify({ createdAt: now }));
    return true;
  } catch {
    return false;
  }
}

/** Atomically clear the local handoff marker. Never accept unsolicited callbacks. */
export function takePendingGoogleOAuth(
  storage: Pick<Storage, "getItem" | "removeItem">,
  now = Date.now(),
): boolean {
  try {
    const raw = storage.getItem(NATIVE_GOOGLE_PENDING_KEY);
    storage.removeItem(NATIVE_GOOGLE_PENDING_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw) as Partial<PendingGoogleOAuth>;
    return typeof value.createdAt === "number" &&
      Number.isFinite(value.createdAt) &&
      value.createdAt <= now &&
      now - value.createdAt <= NATIVE_GOOGLE_TIMEOUT_MS;
  } catch {
    return false;
  }
}

export function clearPendingGoogleOAuth(storage: Pick<Storage, "removeItem">): void {
  try { storage.removeItem(NATIVE_GOOGLE_PENDING_KEY); } catch { /* blocked storage */ }
}

/**
 * Until an administrator installs the Google client ID/secret in Supabase and
 * allowlists the deep link, do not launch a known-broken HTTP 400 flow.
 * This flag is public configuration, never a secret.
 */
export function nativeGoogleProviderReady(flag: unknown): boolean {
  return flag === "true";
}

/** Reject a provider URL pointing off the exact configured Supabase origin. */
export function validNativeGoogleAuthorizeUrl(raw: string | null | undefined, supabaseUrl: string, callback: string): string | null {
  try {
    if (!raw) return null;
    const target = new URL(raw);
    const configured = new URL(supabaseUrl);
    if (configured.protocol !== "https:" || target.protocol !== "https:" ||
        target.origin !== configured.origin || target.username || target.password ||
        target.pathname !== "/auth/v1/authorize" || target.hash ||
        target.searchParams.getAll("provider").length !== 1 ||
        target.searchParams.get("provider") !== "google" ||
        target.searchParams.getAll("redirect_to").length !== 1 ||
        target.searchParams.get("redirect_to") !== callback ||
        ["access_token", "refresh_token", "id_token", "code"].some(k => target.searchParams.has(k))) return null;
    return target.href;
  } catch {
    return null;
  }
}
