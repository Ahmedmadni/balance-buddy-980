import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

function parts(version: string) {
  const [major, minor, patch] = version.split(".").map(Number);
  return [major, minor, patch] as const;
}
function gte(actual: string, minimum: string): boolean {
  const a=parts(actual), b=parts(minimum);
  return a[0]>b[0] || a[0]===b[0] && (a[1]>b[1] || a[1]===b[1] && a[2]>=b[2]);
}

describe("CVE-2026-102989 release gate", () => {
  it("requires patched TanStack Start and server-function transport", () => {
    const lock=JSON.parse(readFileSync("package-lock.json","utf8"));
    for (const [name, minimum] of Object.entries({
      "@tanstack/react-start": "1.168.60",
      "@tanstack/start-server-core": "1.169.39",
      "@tanstack/start-plugin-core": "1.171.49",
    })) {
      const actual=lock.packages["node_modules/"+name]?.version;
      expect(actual, name+" must be installed").toBeTruthy();
      expect(gte(actual, minimum), name+" "+actual+" is below the patched version").toBe(true);
    }
  });
});
