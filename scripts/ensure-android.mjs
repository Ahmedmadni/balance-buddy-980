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

// Native privacy protection for Android's recent-apps snapshot. Keep screenshots
// available while the user is actively viewing their own financial reports.
const activityJava = "android/app/src/main/java/app/lovable/rasd/MainActivity.java";
if (!existsSync(activityJava)) {
  throw new Error("MainActivity.java not found; verify Capacitor package layout before release");
}
let activitySource = readFileSync(activityJava, "utf8");
if (!activitySource.includes("FLAG_SECURE")) {
  if (!activitySource.includes("import com.getcapacitor.BridgeActivity;")) {
    throw new Error("Unexpected MainActivity.java: cannot add privacy lifecycle handlers");
  }
  activitySource = activitySource.replace(
    "import com.getcapacitor.BridgeActivity;",
    "import com.getcapacitor.BridgeActivity;\nimport android.view.WindowManager;"
  );
  const opening = /public class MainActivity extends BridgeActivity\s*\{/;
  if (!opening.test(activitySource)) throw new Error("MainActivity class not found for privacy hardening");
  activitySource = activitySource.replace(opening, (match) => match + `
    // Prevent Android's Recents thumbnail from exposing finance data.
    @Override
    public void onPause() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        super.onPause();
    }

    // Allow screenshots while the owner is actively using the application.
    @Override
    public void onResume() {
        super.onResume();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
`);
  writeFileSync(activityJava, activitySource);
}

const printerJavaPath = "android/app/src/main/java/app/lovable/rasd/RasdPrintPlugin.java";
const printerJavaSource = `package app.lovable.rasd;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens the Android system printing UI (including Save as PDF). */
@CapacitorPlugin(name = "RasdPrinter")
public class RasdPrintPlugin extends Plugin {
    @PluginMethod
    public void printPage(PluginCall call) {
        String requestedName = call.getString("name");
        final String jobName = requestedName == null || requestedName.isEmpty() ? "Rasd Report" : requestedName;
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView == null) {
                    call.reject("Print WebView is unavailable");
                    return;
                }
                PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (manager == null) {
                    call.reject("Android PrintManager is unavailable");
                    return;
                }
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                manager.print(jobName, adapter, new PrintAttributes.Builder().build());
                call.resolve();
            } catch (Exception e) {
                call.reject("Unable to open Android print dialog", e);
            }
        });
    }
}
`;
if (!existsSync(printerJavaPath) || readFileSync(printerJavaPath, "utf8") !== printerJavaSource) {
  writeFileSync(printerJavaPath, printerJavaSource);
}
activitySource = readFileSync(activityJava, "utf8");
if (!activitySource.includes("registerPlugin(RasdPrintPlugin.class)")) {
  if (!activitySource.includes("import android.os.Bundle;")) {
    activitySource = activitySource.replace(
      "import com.getcapacitor.BridgeActivity;",
      "import com.getcapacitor.BridgeActivity;\\nimport android.os.Bundle;"
    );
  }
  const mainClass = /public class MainActivity extends BridgeActivity\\s*\\{/;
  if (!mainClass.test(activitySource)) throw new Error("Cannot register RasdPrintPlugin in MainActivity");
  activitySource = activitySource.replace(mainClass, (match) => match + `
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RasdPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
`);
  writeFileSync(activityJava, activitySource);
}
