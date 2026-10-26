import { describe, expect, test } from "bun:test";
import { validateAndroidReleaseUrl } from "./release-url";

describe("Android hosted release boundary", () => {
  test("accepts the published HTTPS application", () => {
    expect(validateAndroidReleaseUrl("https://balance-buddy-980.lovable.app")).toBe("https://balance-buddy-980.lovable.app/");
  });
  test("rejects cleartext, credentials and preview hosts", () => {
    for (const url of ["http://balance-buddy-980.lovable.app", "https://user:pass@example.com",
      "https://localhost", "https://127.0.0.1", "https://demo.lovableproject.com",
      "https://id-preview--demo.lovable.app"]) {
      expect(() => validateAndroidReleaseUrl(url)).toThrow();
    }
  });
});