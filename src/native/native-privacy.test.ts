import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
describe("Android native finance privacy gate",()=>{
  test("generated Android activity is required to block screenshots and recents previews",()=>{
    const source=readFileSync("scripts/harden-native-manifest.mjs","utf8");
    expect(source).toContain("WindowManager.LayoutParams.FLAG_SECURE");
    expect(source).toContain("getWindow()");
    expect(source).toContain("Expected exactly one generated Android MainActivity.java");
    expect(source).toContain('android:allowBackup="false"');
  });
  test("every Android APK workflow runs hardening after Capacitor sync",()=>{
    for(const p of [".github/workflows/android-debug.yml",
      ".github/workflows/android-emulator-smoke.yml",
      ".github/workflows/android-signed-aab.yml"]){
      const flow=readFileSync(p,"utf8");
      expect(flow).toContain("scripts/harden-native-manifest.mjs");
    }
  });
});
