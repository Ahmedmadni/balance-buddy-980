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
});
