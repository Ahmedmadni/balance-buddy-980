import {readFileSync,writeFileSync,readdirSync} from "node:fs";
import {join} from "node:path";

const filename="android/app/src/main/AndroidManifest.xml";
let xml=readFileSync(filename,"utf8");
if(!/<application\b/.test(xml))throw new Error("Android application manifest section missing");
if(/android:allowBackup="(?:true|false)"/.test(xml))
  xml=xml.replace(/android:allowBackup="(?:true|false)"/,'android:allowBackup="false"');
else xml=xml.replace(/<application\b/,'<application android:allowBackup="false"');
if(!/android:allowBackup="false"/.test(xml))throw new Error("Failed to disable Android automatic app backup");
writeFileSync(filename,xml,"utf8");

// The Android platform is generated in CI and intentionally untracked. Patch
// its MainActivity after `cap sync` and fail the build if patching is impossible.
// FLAG_SECURE protects the task switcher snapshot and disallows screenshots and
// screen recordings of personal financial data, even before JS has locked.
function findMainActivity(dir){
  const matches=[];
  for(const item of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,item.name);
    if(item.isDirectory())matches.push(...findMainActivity(path));
    else if(item.isFile()&&item.name==="MainActivity.java")matches.push(path);
  }
  return matches;
}
const candidates=findMainActivity("android/app/src/main/java");
if(candidates.length!==1)throw new Error("Expected exactly one generated Android MainActivity.java");
const activityPath=candidates[0];
let java=readFileSync(activityPath,"utf8");
if(!/public class MainActivity extends BridgeActivity\s*\{/.test(java))
  throw new Error("Unexpected Capacitor MainActivity.java structure");
if(!java.includes("import android.os.Bundle;"))
  java=java.replace(/(import com\.getcapacitor\.BridgeActivity;)/,
    '$1\nimport android.os.Bundle;');
if(!java.includes("import android.view.WindowManager;"))
  java=java.replace(/(import com\.getcapacitor\.BridgeActivity;)/,
    '$1\nimport android.view.WindowManager;');
if(!java.includes("FLAG_SECURE"))
  java=java.replace(/(public class MainActivity extends BridgeActivity\s*\{)/,
    '$1\n  @Override\n  public void onCreate(Bundle savedInstanceState) {\n'+
    '    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);\n'+
    '    super.onCreate(savedInstanceState);\n  }');
if(!/getWindow\(\)\.addFlags\(WindowManager\.LayoutParams\.FLAG_SECURE\)/.test(java))
  throw new Error("Failed to set native Android FLAG_SECURE");
writeFileSync(activityPath,java,"utf8");
console.log("Android OS auto-backup disabled and screen/recents privacy FLAG_SECURE enabled.");
