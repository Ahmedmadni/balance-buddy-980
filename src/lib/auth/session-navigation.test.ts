import { describe, expect, test } from "bun:test";
import { authReturnUrl, canEnterApp } from "./session-navigation";

describe("OAuth session boundary", () => {
  test("returns to the public auth page on the same origin", () => {
    expect(authReturnUrl("https://balance-buddy-980.lovable.app")).toBe("https://balance-buddy-980.lovable.app/auth");
  });
  test("does not enter the protected app without a hydrated session", () => {
    expect(canEnterApp(null)).toBe(false);
    expect(canEnterApp({ access_token: "" })).toBe(false);
    expect(canEnterApp({ access_token: "test-session" })).toBe(true);
  });
});