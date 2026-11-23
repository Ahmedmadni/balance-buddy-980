import { describe, expect, test } from "bun:test";
import { parseNativeAuthCallback, NATIVE_AUTH_CALLBACK } from "./native-callback-url";

describe("Android OAuth callback validation", () => {
  test("accepts the exact app scheme and one-time PKCE code", () => {
    expect(parseNativeAuthCallback(NATIVE_AUTH_CALLBACK + "?code=abc")).toEqual({kind: "code", code: "abc"});
  });
  test("never consumes bearer tokens from an app-scheme URL", () => {
    expect(parseNativeAuthCallback(NATIVE_AUTH_CALLBACK + "#access_token=aa&refresh_token=bb")?.kind).toBe("error");
  });
  test("rejects look-alike hosts and unrelated routes", () => {
    for (const url of ["https://evil.example/auth/callback?code=abc", "app.lovable.rasd://other/callback?code=abc",
      "app.lovable.rasd://auth/else?code=abc", "app.lovable.rasd://auth.evil/callback?code=abc"]) {
      expect(parseNativeAuthCallback(url)).toBeNull();
    }
  });
  test("handles a canceled provider callback", () => {
    expect(parseNativeAuthCallback(NATIVE_AUTH_CALLBACK + "?error=access_denied")?.kind).toBe("error");
  });
  test("rejects mixed code/token payloads without returning bearer credentials", () => {
    for (const suffix of ["?code=abc&access_token=private-fixture", "?code=abc#refresh_token=private-fixture", "?id_token=private-fixture"]) {
      const result = parseNativeAuthCallback(NATIVE_AUTH_CALLBACK + suffix);
      expect(result?.kind).toBe("error");
      expect(JSON.stringify(result)).not.toContain("private-fixture");
    }
  });
  test("provider error details are not returned to the UI", () => {
    expect(parseNativeAuthCallback(NATIVE_AUTH_CALLBACK + "?error_description=private-fixture")).toEqual({kind: "error", message: "لم يكتمل تسجيل الدخول."});
  });
  test("ambiguous codes and credential-bearing callbacks are not accepted", () => {
    expect(parseNativeAuthCallback(NATIVE_AUTH_CALLBACK + "?code=a&code=b")?.kind).toBe("error");
    expect(parseNativeAuthCallback("app.lovable.rasd://user:pass@auth/callback?code=a")).toBeNull();
    expect(parseNativeAuthCallback("app.lovable.rasd://auth:42/callback?code=a")).toBeNull();
  });
});
