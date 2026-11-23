import { describe, expect, test } from "bun:test";
import {
  clearPendingGoogleOAuth,
  nativeGoogleProviderReady,
  NATIVE_GOOGLE_TIMEOUT_MS,
  recordPendingGoogleOAuth,
  takePendingGoogleOAuth,
  validNativeGoogleAuthorizeUrl,
} from "./native-google-state";

function store() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
}

describe("Rasd native Google OAuth PKCE guard", () => {
  test("requires an explicit deployment-ready flag (not user-supplied URL)", () => {
    expect(nativeGoogleProviderReady(undefined)).toBe(false);
    expect(nativeGoogleProviderReady("true")).toBe(true);
    expect(nativeGoogleProviderReady("TRUE")).toBe(false);
    expect(nativeGoogleProviderReady("false")).toBe(false);
    expect(nativeGoogleProviderReady(true)).toBe(false);
  });

  test("accepts only this Supabase origin and exact app callback", () => {
    const base = "https://tbwogguzpygnbkjmoeeh.supabase.co";
    const cb = "app.lovable.rasd://auth/callback";
    const correct = base + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(cb) + "&state=opaque";
    expect(validNativeGoogleAuthorizeUrl(correct, base, cb)).toBe(correct);
    for (const url of [
      "https://evil.example/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(cb),
      base + ".evil.example/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(cb),
      "http://tbwogguzpygnbkjmoeeh.supabase.co/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(cb),
      base + "/auth/v1/authorize?provider=github&redirect_to=" + encodeURIComponent(cb),
      base + "/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fevil.example",
      base + "/auth/v1/token?provider=google&redirect_to=" + encodeURIComponent(cb),
    ]) expect(validNativeGoogleAuthorizeUrl(url, base, cb)).toBeNull();
  });

  test("pending marker is one-time, persists in same storage, and expires", () => {
    const s = store(), now = 1763890000000;
    expect(recordPendingGoogleOAuth(s, now)).toBe(true);
    expect(takePendingGoogleOAuth(s, now + 60000)).toBe(true);
    expect(takePendingGoogleOAuth(s, now + 60000)).toBe(false);
    expect(recordPendingGoogleOAuth(s, now)).toBe(true);
    expect(takePendingGoogleOAuth(s, now + NATIVE_GOOGLE_TIMEOUT_MS + 1)).toBe(false);
  });
  test("no marker, corrupt marker, and future marker never permit callback exchange", () => {
    const s = store(), now = 1763890000000;
    expect(takePendingGoogleOAuth(s, now)).toBe(false);
    s.setItem("rasd-native-google-pkce-pending-v1", "{invalid");
    expect(takePendingGoogleOAuth(s, now)).toBe(false);
    expect(recordPendingGoogleOAuth(s, now + 5000)).toBe(true);
    expect(takePendingGoogleOAuth(s, now)).toBe(false);
    clearPendingGoogleOAuth(s);
  });
  test("blocked localStorage cannot silently start an unauthenticated handoff", () => {
    expect(recordPendingGoogleOAuth({ setItem() { throw new Error("blocked"); } })).toBe(false);
  });
});
