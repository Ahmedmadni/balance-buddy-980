import { describe, expect, test } from "bun:test";
import { processNativeGoogleCallback, type NativeGoogleAuthGateway } from "./native-google-handoff";
import { recordPendingGoogleOAuth } from "./native-google-state";
import { NATIVE_AUTH_CALLBACK } from "./native-callback-url";

function storage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}
const now = 1763890000000;
function authForTest() {
  let getCalls = 0, exchanges = 0;
  const auth: NativeGoogleAuthGateway = {
    getUser: async () => ({ data: { user: ++getCalls === 1 ? null : { id: "same-account" } }, error: null }),
    exchangeCodeForSession: async (code: string) => {
      expect(code).toBe("one-time-code");
      exchanges++;
      return { data: { user: { id: "same-account" }, session: { access_token: "synthetic-access" } }, error: null };
    },
  };
  return { auth, count: () => exchanges };
}

describe("Android Google PKCE deep link completion", () => {
  test("exchanges only a pending code and verifies the same authenticated user", async () => {
    const s = storage(), x = authForTest();
    recordPendingGoogleOAuth(s, now);
    const result = await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?code=one-time-code", s, x.auth, now + 1000);
    expect(result).toEqual({ kind: "success" });
    expect(x.count()).toBe(1);
    expect(await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?code=one-time-code", s, x.auth, now + 1001))
      .toHaveProperty("kind", "error");
    expect(x.count()).toBe(1);
    expect(JSON.stringify(result)).not.toContain("synthetic-access");
  });
  test("cannot exchange a forged unsolicited deep link", async () => {
    const x = authForTest();
    const result = await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?code=one-time-code", storage(), x.auth, now);
    expect(result.kind).toBe("error"); expect(x.count()).toBe(0);
  });
  test("wrong host is ignored without consuming pending intent", async () => {
    const s = storage(), x = authForTest();
    recordPendingGoogleOAuth(s, now);
    expect((await processNativeGoogleCallback("https://evil.example/?code=one-time-code", s, x.auth, now)).kind).toBe("ignored");
    expect((await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?code=one-time-code", s, x.auth, now)).kind).toBe("success");
  });
  test("provider errors never reveal error_description, refresh_token, or id_token", async () => {
    const s = storage(), x = authForTest();
    recordPendingGoogleOAuth(s, now);
    const result = await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?error_description=private-fixture", s, x.auth, now);
    expect(result.kind).toBe("error");
    expect(JSON.stringify(result)).not.toContain("private-fixture");
    expect(x.count()).toBe(0);
    recordPendingGoogleOAuth(s, now);
    const token = await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "#access_token=private-fixture", s, x.auth, now);
    expect(token.kind).toBe("error");
    expect(JSON.stringify(token)).not.toContain("private-fixture");
  });
  test("expires a pending attempt rather than allowing long-delayed callbacks", async () => {
    const s = storage(), x = authForTest();
    recordPendingGoogleOAuth(s, now);
    expect((await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?code=one-time-code", s, x.auth, now + 11*60*1000)).kind).toBe("error");
    expect(x.count()).toBe(0);
  });
  test("never overwrites an already signed-in user", async () => {
    const s = storage();
    recordPendingGoogleOAuth(s, now);
    let called = false;
    const auth: NativeGoogleAuthGateway = {
      getUser: async () => ({ data: { user: { id: "existing-owner" } }, error: null }),
      exchangeCodeForSession: async () => { called = true; throw new Error("must not execute"); },
    };
    expect((await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?code=x", s, auth, now)).kind).toBe("error");
    expect(called).toBe(false);
  });
  test("refuses a session with a mismatched server-validated account", async () => {
    const s = storage();
    recordPendingGoogleOAuth(s, now);
    let calls = 0;
    const auth: NativeGoogleAuthGateway = {
      getUser: async () => ({ data: { user: ++calls === 1 ? null : { id: "another-account" } }, error: null }),
      exchangeCodeForSession: async () => ({ data: { user: { id: "expected" }, session: { access_token: "secret" } }, error: null }),
    };
    expect((await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?code=valid", s, auth, now)).kind).toBe("error");
  });
});
