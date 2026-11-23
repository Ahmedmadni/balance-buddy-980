/**
 * Generate Android's actual installed launcher and splash resources.
 * The SSR app uses a hosted WebView, so cap sync alone previously shipped
 * Capacitor's blue default launcher/splash, regardless of the web brand.
 *
 * Editable, vector master: assets/logo.svg — the same wallet mark shown
 * in Rasd's authentication UI. Do not use unrelated resources/icon.png
 * or resources/splash.png from older design experiments.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync("android/app/src/main/AndroidManifest.xml")) {
  throw new Error("Run scripts/ensure-android.mjs before generating native branding");
}
if (!existsSync("assets/logo.svg")) {
  throw new Error("Missing Rasd logo master: assets/logo.svg");
}
const isWindows = process.platform === "win32";
const result = spawnSync("npx", [
  "capacitor-assets", "generate", "--android", "--assetPath", "assets",
  "--iconBackgroundColor", "#0b1220",
  "--splashBackgroundColor", "#0b1220",
  "--splashBackgroundColorDark", "#0b1220",
], { stdio: "inherit", shell: isWindows });
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Rasd Android icon/splash generation failed (exit ${result.status})`);
}
const hasIcon = [
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  "android/app/src/main/res/mipmap-xxxhdpi-v4/ic_launcher.png",
].some(existsSync);
const hasSplash = [
  "android/app/src/main/res/drawable-port-xxxhdpi/splash.png",
  "android/app/src/main/res/drawable-port-xxxhdpi-v4/splash.png",
].some(existsSync);
if (!hasIcon || !hasSplash) {
  throw new Error("Rasd Android launcher or portrait splash resources not generated");
}
console.log("Rasd branded Android launcher and splash generated.");
