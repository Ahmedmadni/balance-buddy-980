import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const authenticatedRoute = readFileSync(
  resolve(root, "src/routes/_authenticated/route.tsx"),
  "utf8",
);
const browserFixture = readFileSync(resolve(root, "e2e/fixtures.ts"), "utf8");

describe("A13 runtime stability", () => {
  test("rejects guests locally before making a remote user validation request", () => {
    const sessionCheck = authenticatedRoute.indexOf("auth.getSession()");
    const guestRedirect = authenticatedRoute.indexOf("!sessionData.session");
    const userValidation = authenticatedRoute.indexOf(
      "auth.getUser(sessionData.session.access_token)",
    );

    expect(sessionCheck).toBeGreaterThan(-1);
    expect(guestRedirect).toBeGreaterThan(sessionCheck);
    expect(userValidation).toBeGreaterThan(guestRedirect);
  });

  test("browser checks reject silent runtime and server failures", () => {
    expect(browserFixture).toContain('page.on("pageerror"');
    expect(browserFixture).toContain('message.type() === "error"');
    expect(browserFixture).toContain("response.status() >= 500");
  });
});
