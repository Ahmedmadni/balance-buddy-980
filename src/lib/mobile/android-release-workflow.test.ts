import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const workflow = readFileSync(new URL("../../../.github/workflows/android-release.yml", import.meta.url), "utf8");
const start = workflow.indexOf("          missing=0");
const end = workflow.indexOf("\n      - name: Check hosted", start);
if (start < 0 || end < 0) throw new Error("Release preflight missing");
const preflight = workflow.slice(start, end);

function accepts(code: string, name: string, secretsPresent = true) {
  return spawnSync("bash", ["-e", "-c", preflight], {
    env: { PATH: process.env.PATH, RELEASE_VERSION_CODE: code, RELEASE_VERSION_NAME: name,
      KS_B64: secretsPresent ? "fixture" : "", KS_PASS: "fixture", KEY_ALIAS: "fixture", KEY_PASS: "fixture" },
    encoding: "utf8",
  }).status === 0;
}

describe("Android signed release preflight", () => {
  test("requires every signing secret", () => {
    expect(accepts("1", "1.0.0", false)).toBe(false);
  });
  test("accepts valid Android version codes and rejects out-of-range codes", () => {
    expect(accepts("1", "1.0.0")).toBe(true);
    expect(accepts("2100000000", "1.0.0")).toBe(true);
    for (const code of ["0", "-1", "2100000001", "1; exit 0", ""]) expect(accepts(code, "1.0.0")).toBe(false);
  });
  test("rejects shell expressions and unsafe version names", () => {
    expect(accepts("2", "1.0.0-rc.1")).toBe(true);
    for (const name of ['$(echo unsafe)', '1"; exit 0; #', "1/2", "", "v".repeat(65)]) expect(accepts("2", name)).toBe(false);
  });
});