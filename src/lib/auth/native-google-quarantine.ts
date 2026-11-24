/**
 * Persistent fail-closed marker for the interval between Supabase installing
 * a PKCE session and Rasd verifying the returned account with getUser().
 *
 * The marker is written BEFORE exchangeCodeForSession and cleared only after
 * verified success or a confirmed local signOut. It stores no code/token/PII.
 * A crash/reload during exchange must never auto-unlock financial routes.
 */
export const NATIVE_GOOGLE_QUARANTINE_KEY = "rasd-native-google-session-quarantine-v1";
export const NATIVE_GOOGLE_QUARANTINE_EVENT = "rasd-native-google-quarantine-changed";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function beginNativeGoogleQuarantine(storage: StorageWriter): boolean {
  try {
    storage.setItem(NATIVE_GOOGLE_QUARANTINE_KEY, "1");
    return storage.getItem(NATIVE_GOOGLE_QUARANTINE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearNativeGoogleQuarantine(storage: StorageWriter): boolean {
  try {
    storage.removeItem(NATIVE_GOOGLE_QUARANTINE_KEY);
    return storage.getItem(NATIVE_GOOGLE_QUARANTINE_KEY) === null;
  } catch {
    return false;
  }
}

export function hasNativeGoogleQuarantine(storage: StorageReader): boolean {
  try {
    return storage.getItem(NATIVE_GOOGLE_QUARANTINE_KEY) === "1";
  } catch {
    // An inaccessible journal cannot prove that a temporary session is safe.
    return true;
  }
}

/** Use only inside the native shell; regular browser sessions are unaffected. */
export function isNativeGoogleQuarantinedOnDevice(): boolean {
  if (typeof window === "undefined") return false;
  const native = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor?.isNativePlatform?.();
  if (!native) return false;
  try {
    return hasNativeGoogleQuarantine(window.localStorage);
  } catch {
    return true;
  }
}
