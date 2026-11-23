/**
 * Cross-platform Capacitor Android build launcher.
 * Supports Linux/macOS CI and Windows PowerShell/CMD + Android Studio.
 */
import { spawnSync } from "node:child_process";

const command = process.argv[2] ?? "debug";
const allowed = new Map([
  ["sync-prod", null],
  ["debug", "assembleDebug"],
  ["apk", "assembleRelease"],
  ["aab", "bundleRelease"],
]);
if (!allowed.has(command)) {
  throw new Error("Usage: node scripts/android-build.mjs sync-prod|debug|apk|aab");
}
const env = { ...process.env, CAP_ENV: "production" };
const isWindows = process.platform === "win32";
const run = (bin, args, options = {}) => {
  const result = spawnSync(bin, args, {
    stdio: "inherit",
    shell: isWindows,
    env,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

run("bun", ["run", "build"]);
run("node", ["scripts/ensure-android.mjs"]);
// The generated Capacitor scaffold contains placeholder icons. Always
// replace those with Rasd branding before syncing and packaging native APKs.
run("node", ["scripts/generate-android-branding.mjs"]);
run("npx", ["cap", "sync", "android"]);
const gradleTask = allowed.get(command);
if (gradleTask) run(isWindows ? "gradlew.bat" : "./gradlew", [gradleTask], { cwd: "android" });
