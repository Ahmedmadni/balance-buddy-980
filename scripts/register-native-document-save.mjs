import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,join} from "node:path";
const activity="android/app/src/main";
const source=readFileSync("scripts/native/RasdDocumentSavePlugin.java.txt","utf8");
const main=readFileSync("android/app/src/main/AndroidManifest.xml","utf8");
if(!main.includes('android:allowBackup="false"'))
  throw new Error("Native document picker must run after Android hardening");
const {readdirSync}=await import("node:fs");
function find(dir){
  return readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
    const full=join(dir,item.name);
    if(item.isDirectory())return find(full);
    return item.isFile()&&item.name==="MainActivity.java"?[full]:[];
  });
}
const found=find(join(activity,"java"));
if(found.length!==1)throw new Error("Expected one Android MainActivity.java");
let mainActivity=readFileSync(found[0],"utf8");
const match=mainActivity.match(/^package\s+([a-zA-Z0-9_.]+);/m);
if(!match)throw new Error("Cannot find Android app package");
if(!mainActivity.includes("FLAG_SECURE"))throw new Error("Android FLAG_SECURE must remain enabled");
if(!mainActivity.includes("registerPlugin(RasdDocumentSavePlugin.class)")){
  mainActivity=mainActivity.replace(
    "getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);",
    "getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);\n    registerPlugin(RasdDocumentSavePlugin.class);"
  );
}
if(!mainActivity.includes("registerPlugin(RasdDocumentSavePlugin.class)"))
  throw new Error("Failed to register native Android document save plugin");
writeFileSync(found[0],mainActivity,"utf8");
const output=join(dirname(found[0]),"RasdDocumentSavePlugin.java");
if(!source.includes("package __RASD_PACKAGE__;"))
  throw new Error("Plugin template is invalid");
writeFileSync(output,source.replace("package __RASD_PACKAGE__;",`package ${match[1]};`),"utf8");
console.log("Registered native Android encrypted document Save As picker in "+match[1]);
