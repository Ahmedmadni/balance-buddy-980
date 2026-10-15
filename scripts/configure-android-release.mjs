#!/usr/bin/env node
// Creates Gradle release signing configuration from environment variables.
// Only a signing KEY FILE PATH and System.getenv(...) references are written
// into the generated Android Gradle project. Never commit the keystore.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function configureReleaseGradle(source, versionCode, versionName) {
  const code = Number(versionCode);
  if (!Number.isSafeInteger(code) || code < 1 || code > 2100000000) {
    throw new Error("versionCode must be a positive integer up to 2100000000");
  }
  if (!/^[0-9]+(?:\.[0-9]+){1,3}(?:-[A-Za-z0-9.-]+)?$/.test(String(versionName))) {
    throw new Error("Invalid Android versionName");
  }
  if (!/\bandroid\s*\{/.test(source) || !/\bversionCode\s+\d+/.test(source)
    || !/\bversionName\s+['"][^'"]+['"]/.test(source)) {
    throw new Error("Capacitor Gradle template changed: cannot set Android version safely");
  }
  if (!/\bbuildTypes\s*\{\s*release\s*\{/.test(source)) {
    throw new Error("Capacitor release buildTypes block not found");
  }
  if (/\bsigningConfigs\s*\{/.test(source)) {
    throw new Error("A signingConfigs block already exists: refuse duplicate signing setup");
  }
  let content = source.replace(/\bversionCode\s+\d+/, `versionCode ${code}`)
    .replace(/\bversionName\s+['"][^'"]+['"]/, `versionName "${versionName}"`);
  const signing = `android {
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }`;
  content = content.replace(/\bandroid\s*\{/, signing);
  content = content.replace(/(\bbuildTypes\s*\{\s*release\s*\{)/,
    '$1\n            signingConfig signingConfigs.release');
  if (!content.includes("signingConfig signingConfigs.release")) throw new Error("Failed to configure release signing");
  return content;
}

if (process.argv.includes("--self-test")) {
  const sample = `android {
 defaultConfig {
  versionCode 1
  versionName "1.0"
 }
 buildTypes {
  release {
   minifyEnabled false
  }
 }
}`;
  const s = configureReleaseGradle(sample, 12, "1.0.12");
  if (!s.includes("versionCode 12") || !s.includes('versionName "1.0.12"')
    || !s.includes("System.getenv(\"ANDROID_KEY_PASSWORD\")")
    || !s.includes("signingConfig signingConfigs.release")) {
    throw new Error("release Gradle self-test failed");
  }
  for (const version of ["x", "1.2;rm -rf /", "-1"]) {
    try { configureReleaseGradle(sample, 12, version); throw new Error("accepted unsafe version"); }
    catch (e) { if (e.message === "accepted unsafe version") throw e; }
  }
  console.log("Android release Gradle transformation self-test passed");
} else {
  const file = resolve("android/app/build.gradle");
  const [code, version] = process.argv.slice(2);
  // Intentional failure if any env var is absent. Secrets are not printed.
  for (const key of ["ANDROID_KEYSTORE_FILE", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"]) {
    if (!process.env[key]) throw new Error(`Missing Android signing environment variable: ${key}`);
  }
  const output = configureReleaseGradle(readFileSync(file, "utf8"), code, version);
  writeFileSync(file, output, "utf8");
  console.log(`Configured Android release signing for versionCode ${code}, versionName ${version}`);
}
