/**
 * Prepare a reproducible Android shell and ensure the Google OAuth callback
 * is registered in the real manifest (not only in web/router configuration).
 * Called by android:sync and android:sync:prod.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const stringsPath = "android/app/src/main/res/values/strings.xml";
const scheme = "app.lovable.rasd";

if (!existsSync(manifestPath)) {
  const added = spawnSync("npx", ["cap", "add", "android"], { stdio: "inherit", shell: process.platform === "win32" });
  if (added.status !== 0) throw new Error("Capacitor Android platform generation failed");
}
if (!existsSync(manifestPath)) throw new Error("AndroidManifest.xml was not generated");
let manifest = readFileSync(manifestPath, "utf8");
if (!manifest.includes('android:scheme="' + scheme + '"')) {
  const filter = [
    '            <intent-filter>',
    '                <action android:name="android.intent.action.VIEW" />',
    '                <category android:name="android.intent.category.DEFAULT" />',
    '                <category android:name="android.intent.category.BROWSABLE" />',
    '                <data android:scheme="' + scheme + '" android:host="auth" android:path="/callback" />',
    '            </intent-filter>',
  ].join("\n");
  const activity = /<activity\b[^>]*>/;
  if (!activity.test(manifest)) throw new Error("MainActivity tag not found in AndroidManifest.xml");
  manifest = manifest.replace(activity, (match) => match + "\n" + filter);
  writeFileSync(manifestPath, manifest);
}
if (existsSync(stringsPath)) {
  let xml = readFileSync(stringsPath, "utf8");
  xml = xml.replace(/<string name="custom_url_scheme">[^<]*<\/string>/, '<string name="custom_url_scheme">' + scheme + '</string>');
  writeFileSync(stringsPath, xml);
}
console.log("Android OAuth deep link installed:", scheme + "://auth/callback");
