import { describe, expect, test } from "bun:test";
import { googleSignInError, NATIVE_GOOGLE_UNAVAILABLE, runGoogleSignIn } from "./google-sign-in-flow";

describe("Google sign-in platform and session boundaries", () => {
  test("Android never invokes broker, provider, or session actions", async () => {
    let oauthCalls = 0;
    let sessionCalls = 0;
    const result = await runGoogleSignIn(true, {
      managedSignIn: async () => { oauthCalls++; return {}; },
      verifyUser: async () => { sessionCalls++; return true; },
    });
    expect(result).toEqual({ kind: "error", message: NATIVE_GOOGLE_UNAVAILABLE });
    expect(oauthCalls).toBe(0);
    expect(sessionCalls).toBe(0);
  });
  test("web uses the managed broker and waits for the validated user", async () => {
    const calls: string[] = [];
    const result = await runGoogleSignIn(false, {
      managedSignIn: async () => { calls.push("broker"); return {}; },
      verifyUser: async () => { calls.push("validated-user"); return true; },
    });
    expect(calls).toEqual(["broker", "validated-user"]);
    expect(result.kind).toBe("authenticated");
  });
  test("a redirect cannot count as a hydrated Android or web session", async () => {
    let verified = false;
    const result = await runGoogleSignIn(false, {
      managedSignIn: async () => ({ redirected: true }),
      verifyUser: async () => { verified = true; return true; },
    });
    expect(result.kind).toBe("redirected");
    expect(verified).toBe(false);
  });
  test("no validated user means no entry to the guarded app", async () => {
    expect((await runGoogleSignIn(false, {
      managedSignIn: async () => ({}), verifyUser: async () => false,
    })).kind).toBe("error");
  });
  test("provider errors do not trigger session validation or expose raw secrets", async () => {
    let verified = false;
    const result = await runGoogleSignIn(false, {
      managedSignIn: async () => ({ error: new Error("Unsupported provider: missing OAuth secret sensitive-fixture") }),
      verifyUser: async () => { verified = true; return true; },
    });
    expect(result).toEqual({ kind: "error", message: googleSignInError(new Error("missing OAuth secret")) });
    expect(JSON.stringify(result)).not.toContain("sensitive-fixture");
    expect(verified).toBe(false);
  });
  test("network exceptions never leak callback tokens or internal URLs", async () => {
    const result = await runGoogleSignIn(false, {
      managedSignIn: async () => { throw new Error("https://internal.invalid/#access_token=private-fixture"); },
      verifyUser: async () => true,
    });
    expect(result.kind).toBe("error");
    expect(JSON.stringify(result)).not.toContain("private-fixture");
    expect(JSON.stringify(result)).not.toContain("internal.invalid");
  });
  test("consent cancellation is safe to retry", () => {
    expect(googleSignInError(new Error("access_denied private-fixture"))).toBe("أُلغي تسجيل الدخول. يمكنك المحاولة مرة أخرى.");
  });
  test("a failed user validation cannot produce success", async () => {
    expect((await runGoogleSignIn(false, {
      managedSignIn: async () => ({}), verifyUser: async () => { throw new Error("expired-session"); },
    })).kind).toBe("error");
  });
});