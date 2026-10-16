import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
describe("Android APK release-safety checks", () => {
 it("verify debug artifact before upload", () => {
   const wf = readFileSync(".github/workflows/android-debug.yml","utf8");
   const script = readFileSync("scripts/check-android-debug.sh","utf8");
   expect(wf).toContain("bash scripts/check-android-debug.sh");
   expect(script).toContain("app.lovable.rasd");
   expect(script).toContain("apksigner");
   expect(script).toContain("keystore");
 });
});
