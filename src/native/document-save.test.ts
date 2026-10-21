import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";

describe("Android document provider save gate",()=>{
  test("registers a verified native Save As plugin in every APK/AAB build",()=>{
    for(const workflow of [".github/workflows/android-debug.yml",
      ".github/workflows/android-emulator-smoke.yml",".github/workflows/android-signed-aab.yml"]){
      const src=readFileSync(workflow,"utf8");
      expect(src).toContain("scripts/register-native-document-save.mjs");
      expect(src.indexOf("scripts/harden-native-manifest.mjs"))
        .toBeLessThan(src.indexOf("scripts/register-native-document-save.mjs"));
    }
    const installer=readFileSync("scripts/register-native-document-save.mjs","utf8");
    expect(installer).toContain("registerPlugin(RasdDocumentSavePlugin.class)");
    expect(installer).toContain("FLAG_SECURE");
  });
  test("only a user-selected document provider receives encrypted private-cache contents",()=>{
    const java=readFileSync("scripts/native/RasdDocumentSavePlugin.java.txt","utf8");
    expect(java).toContain("Intent.ACTION_CREATE_DOCUMENT");
    expect(java).toContain("Intent.CATEGORY_OPENABLE");
    expect(java).not.toContain("android/app");
    expect(java).toContain("digestFile(source).equals(expectedDigest)");
    expect(java).toContain("getCacheDir()");
    expect(java).toContain("getContentResolver().openOutputStream(destination");
    expect(java).not.toContain("MANAGE_EXTERNAL_STORAGE");
    expect(java).not.toContain("ACCESS_ALL_FILES");
    expect(java).not.toContain("GoogleSignIn");
  });
  test("native Save As never exposes decrypted financial records or raw secrets",()=>{
    const backup=readFileSync("src/native/backup.ts","utf8");
    expect(backup).toContain("validate(name,backup)");
    expect(backup).toContain('crypto.subtle.digest("SHA-256",bytes)');
    expect(backup).toContain("RasdDocumentSave.saveEncryptedDocument({fileName:name,sha256})");
    expect(backup).not.toContain("saveEncryptedDocument({data:");
    const ui=readFileSync("src/native/NativeApp.tsx","utf8");
    expect(ui).toContain("حفظ باسم — الهاتف أو Google Drive");
    expect(ui).toContain('destination==="document"');
  });
});
