import { describe, expect, test } from "bun:test";
import {
  isNativeGoogleSessionVerificationInProgress,
  processNativeGoogleCallback, type NativeGoogleAuthGateway,
} from "./native-google-handoff";
import { recordPendingGoogleOAuth } from "./native-google-state";
import { NATIVE_AUTH_CALLBACK } from "./native-callback-url";
import { hasNativeGoogleQuarantine } from "./native-google-quarantine";

const now = 1763890000000;
const callback = NATIVE_AUTH_CALLBACK + "?code=one-time-code";
function storage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

function gateway() {
  let getCalls = 0, exchanges = 0, signOuts = 0;
  let localSession: { access_token: string } | null = null;
  const auth: NativeGoogleAuthGateway = {
    getSession: async () => ({ data: { session: localSession }, error: null }),
    getUser: async () => ({
      data: { user: ++getCalls === 1 ? null : { id: "same-account" } }, error: null,
    }),
    exchangeCodeForSession: async (code) => {
      expect(code).toBe("one-time-code");
      expect(isNativeGoogleSessionVerificationInProgress()).toBe(true);
      exchanges++;
      localSession = { access_token: "synthetic-access" };
      return { data: { user: { id: "same-account" }, session: localSession }, error: null };
    },
    signOutLocal: async () => { signOuts++; localSession = null; return { error: null }; },
  };
  return { auth, count: () => exchanges, signOuts: () => signOuts, session: () => localSession };
}

describe("Rasd Android Google PKCE account verification boundary", () => {
  test("accepts only a new one-time code and verifies matching server user", async () => {
    const s = storage(), x = gateway();
    recordPendingGoogleOAuth(s, now);
    const result = await processNativeGoogleCallback(callback, s, x.auth, now + 1000);
    expect(result).toEqual({ kind: "success" });
    expect(x.count()).toBe(1);
    expect(x.signOuts()).toBe(0);
    expect(isNativeGoogleSessionVerificationInProgress()).toBe(false);
    expect((await processNativeGoogleCallback(callback, s, x.auth, now + 1001)).kind).toBe("error");
    expect(x.count()).toBe(1);
    expect(JSON.stringify(result)).not.toContain("synthetic-access");
  });

  test("cannot exchange a forged unsolicited callback", async () => {
    const x = gateway();
    expect((await processNativeGoogleCallback(callback, storage(), x.auth, now)).kind).toBe("error");
    expect(x.count()).toBe(0);
  });

  test("foreign host does not consume an existing pending intent", async () => {
    const s = storage(), x = gateway();
    recordPendingGoogleOAuth(s, now);
    expect((await processNativeGoogleCallback("https://evil.example/?code=one-time-code", s, x.auth, now)).kind).toBe("ignored");
    expect((await processNativeGoogleCallback(callback, s, x.auth, now)).kind).toBe("success");
  });

  test("provider errors never expose their details or bearer tokens", async () => {
    const s = storage(), x = gateway();
    recordPendingGoogleOAuth(s, now);
    const error = await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "?error_description=private-fixture", s, x.auth, now);
    expect(error.kind).toBe("error");
    expect(JSON.stringify(error)).not.toContain("private-fixture");
    expect(x.count()).toBe(0);
    recordPendingGoogleOAuth(s, now);
    const token = await processNativeGoogleCallback(NATIVE_AUTH_CALLBACK + "#access_token=private-fixture", s, x.auth, now);
    expect(token.kind).toBe("error");
    expect(JSON.stringify(token)).not.toContain("private-fixture");
  });

  test("rejects expired pending request", async () => {
    const s = storage(), x = gateway();
    recordPendingGoogleOAuth(s, now);
    expect((await processNativeGoogleCallback(callback, s, x.auth, now + 11 * 60 * 1000)).kind).toBe("error");
    expect(x.count()).toBe(0);
  });

  test("blocks existing local session BEFORE any new exchange", async () => {
    const s = storage();
    recordPendingGoogleOAuth(s, now);
    let exchanged = false;
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({ data: { session: { access_token: "owner-session" } }, error: null }),
      getUser: async () => { throw new Error("getUser must not run"); },
      exchangeCodeForSession: async () => { exchanged = true; throw new Error("must not run"); },
      signOutLocal: async () => { throw new Error("must not sign out owner"); },
    };
    expect((await processNativeGoogleCallback(callback, s, auth, now)).kind).toBe("error");
    expect(exchanged).toBe(false);
  });

  test("blocks when checking current session or server user fails", async () => {
    for (const which of ["session", "user"] as const) {
      const s = storage();
      recordPendingGoogleOAuth(s, now);
      let exchanges = 0;
      const auth: NativeGoogleAuthGateway = {
        getSession: async () => ({ data: { session: null }, error: which === "session" ? new Error("offline") : null }),
        getUser: async () => ({ data: { user: null }, error: which === "user" ? new Error("offline") : null }),
        exchangeCodeForSession: async () => { exchanges++; throw new Error("must not exchange"); },
        signOutLocal: async () => { throw new Error("must not sign out"); },
      };
      expect((await processNativeGoogleCallback(callback, s, auth, now)).kind).toBe("error");
      expect(exchanges).toBe(0);
    }
  });

  test("invalid server identity rolls back newly issued local session", async () => {
    const s = storage(); recordPendingGoogleOAuth(s, now);
    let count = 0, localSession = false, signouts = 0;
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: ++count === 1 ? null : { id: "another-account" } }, error: null }),
      exchangeCodeForSession: async () => {
        localSession = true;
        return { data: { user: { id: "expected" }, session: { access_token: "secret" } }, error: null };
      },
      signOutLocal: async () => { signouts++; localSession = false; return { error: null }; },
    };
    expect((await processNativeGoogleCallback(callback, s, auth, now)).kind).toBe("error");
    expect(signouts).toBe(1);
    expect(localSession).toBe(false);
    expect(isNativeGoogleSessionVerificationInProgress()).toBe(false);
  });

  test("server verification error after exchange triggers local sign out", async () => {
    const s = storage(); recordPendingGoogleOAuth(s, now);
    let requests = 0, signouts = 0;
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: ++requests === 1 ? null : { id: "irrelevant" } }, error: requests === 1 ? null : new Error("offline") }),
      exchangeCodeForSession: async () => ({ data: { user: { id: "expected" }, session: { access_token: "secret" } }, error: null }),
      signOutLocal: async () => { signouts++; return { error: null }; },
    };
    expect((await processNativeGoogleCallback(callback, s, auth, now)).kind).toBe("error");
    expect(signouts).toBe(1);
  });

  test("protected navigation flag remains active throughout asynchronous identity verification", async () => {
    const s = storage(); recordPendingGoogleOAuth(s, now);
    let resolveVerification!: () => void;
    let signalEntered!: () => void;
    const gate = new Promise<void>(r => { resolveVerification = r; });
    const entered = new Promise<void>(r => { signalEntered = r; });
    let calls = 0;
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => {
        if (++calls === 1) return { data: { user: null }, error: null };
        signalEntered();
        await gate;
        return { data: { user: { id: "expected" } }, error: null };
      },
      exchangeCodeForSession: async () => ({ data: { user: { id: "expected" }, session: { access_token: "secret" } }, error: null }),
      signOutLocal: async () => ({ error: null }),
    };
    const pending = processNativeGoogleCallback(callback, s, auth, now);
    await entered;
    expect(isNativeGoogleSessionVerificationInProgress()).toBe(true);
    resolveVerification();
    expect((await pending).kind).toBe("success");
    expect(isNativeGoogleSessionVerificationInProgress()).toBe(false);
  });
  test("a failed local rollback leaves a persistent guard that survives a simulated restart", async () => {
    const s = storage(); recordPendingGoogleOAuth(s, now);
    let call = 0, signOuts = 0;
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: ++call === 1 ? null : { id: "not-the-expected-account" } }, error: null }),
      exchangeCodeForSession: async () => ({
        data: { user: { id: "expected" }, session: { access_token: "private-token" } }, error: null,
      }),
      signOutLocal: async () => { signOuts++; return { error: new Error("storage failure") }; },
    };
    const result = await processNativeGoogleCallback(callback, s, auth, now);
    expect(result.kind).toBe("error");
    expect(signOuts).toBe(1);
    expect(hasNativeGoogleQuarantine(s)).toBe(true);
    // New callback must not override an unverified stored session.
    recordPendingGoogleOAuth(s, now);
    const second = await processNativeGoogleCallback(callback, s, auth, now + 10);
    expect(second.kind).toBe("error");
    expect(signOuts).toBe(1);
  });

  test("a nominally successful sign-out cannot clear quarantine while tokens remain cached", async () => {
    const s = storage(); recordPendingGoogleOAuth(s, now);
    let call = 0, sessionPresent = false, signOuts = 0;
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({
        data: { session: sessionPresent ? { access_token: "token-still-cached" } : null }, error: null,
      }),
      getUser: async () => ({ data: { user: ++call === 1 ? null : { id: "wrong-user" } }, error: null }),
      exchangeCodeForSession: async () => {
        sessionPresent = true;
        return { data: { user: { id: "expected" }, session: { access_token: "token-still-cached" } }, error: null };
      },
      signOutLocal: async () => { signOuts++; return { error: null }; },
    };
    expect((await processNativeGoogleCallback(callback, s, auth, now)).kind).toBe("error");
    expect(signOuts).toBe(1);
    expect(hasNativeGoogleQuarantine(s)).toBe(true);
  });

  test("a thrown exchange triggers local rollback even without a response marker", async () => {
    const s = storage(); recordPendingGoogleOAuth(s, now);
    let signOuts = 0;
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      exchangeCodeForSession: async () => { throw new Error("network lost after server response"); },
      signOutLocal: async () => { signOuts++; return { error: null }; },
    };
    expect((await processNativeGoogleCallback(callback, s, auth, now)).kind).toBe("error");
    expect(signOuts).toBe(1);
    expect(hasNativeGoogleQuarantine(s)).toBe(false);
  });

  test("a failed storage write prevents exchanging an OAuth code", async () => {
    const s = storage(); recordPendingGoogleOAuth(s, now);
    let calls = 0, signs = 0;
    const blockedStorage = {
      getItem: s.getItem,
      removeItem: s.removeItem,
      setItem: (_k: string, _v: string) => { throw new Error("quota"); },
    };
    const auth: NativeGoogleAuthGateway = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      exchangeCodeForSession: async () => { calls++; throw new Error("must not exchange"); },
      signOutLocal: async () => { signs++; return { error: null }; },
    };
    expect((await processNativeGoogleCallback(callback, blockedStorage, auth, now)).kind).toBe("error");
    expect(calls).toBe(0);
    expect(signs).toBe(0);
  });

});
