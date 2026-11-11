/**
 * Prepare a reproducible Android shell and ensure the Google OAuth callback
 * is registered in the real manifest (not only in web/router configuration).
 * Called by android:sync and android:sync:prod.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const stringsPath = "android/app/src/main/res/values/strings.xml";
const scheme = "app.lovable.rasd";
const webDir = "dist/client";
// TanStack Start is SSR and emits no static index.html. Capacitor requires one
// to generate/sync the shell even though the Android production app uses server.url.
mkdirSync(webDir, { recursive: true });
if (!existsSync(webDir + "/index.html")) {
  writeFileSync(webDir + "/index.html", `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رصد</title></head><body style="font-family:system-ui;text-align:center;padding:3rem"><h2>رصد</h2><p>يتطلب فتح البرنامج الاتصال بالإنترنت.</p></body></html>`);
}

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
