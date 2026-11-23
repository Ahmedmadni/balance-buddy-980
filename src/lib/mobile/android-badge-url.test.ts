import { describe, expect, test } from "bun:test";
import { androidBadgeUrl, androidBadgeReloadUrl, androidHostedLoginEntryUrl } from "./android-badge-url";

describe("Android-only hosted badge URL", () => {
  test("Android launches the existing published host with the observed flag", () => {
    expect(androidBadgeUrl("https://balance-buddy-980.lovable.app")).toBe("https://balance-buddy-980.lovable.app/?forceHideBadge=true");
  });
  test("Android starts on the login route without losing the badge parameter to a root redirect", () => {
    expect(androidHostedLoginEntryUrl("https://balance-buddy-980.lovable.app"))
      .toBe("https://balance-buddy-980.lovable.app/auth?forceHideBadge=true");
  });
  test("ordinary website visitors are never redirected", () => {
    expect(androidBadgeReloadUrl("https://balance-buddy-980.lovable.app/auth", false)).toBeNull();
  });
  test("Android nested hard reload retains path and unrelated query parameters", () => {
    expect(androidBadgeReloadUrl("https://balance-buddy-980.lovable.app/app/settings?tab=mobile", true)).toBe("https://balance-buddy-980.lovable.app/app/settings?tab=mobile&forceHideBadge=true");
  });
  test("applying the flag is idempotent and cannot loop", () => {
    const target = androidBadgeUrl("https://balance-buddy-980.lovable.app/auth?forceHideBadge=false");
    expect(androidBadgeUrl(target)).toBe(target);
    expect(androidBadgeReloadUrl(target, true)).toBeNull();
  });
  test("badge redirects never retransmit OAuth URL material", () => {
    for (const suffix of ["?code=test", "?access_token=test", "?refresh_token=test", "?error=access_denied", "#access_token=test"]) {
      expect(androidBadgeReloadUrl("https://balance-buddy-980.lovable.app/auth" + suffix, true)).toBeNull();
    }
  });
  test("rejects insecure or credential-bearing hosts", () => {
    for (const value of ["http://balance-buddy-980.lovable.app", "https://user:pass@example.com"]) {
      expect(() => androidBadgeUrl(value)).toThrow();
      expect(androidBadgeReloadUrl(value, true)).toBeNull();
    }
  });
});