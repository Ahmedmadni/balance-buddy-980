import {readFileSync,writeFileSync} from "node:fs";
const filename="android/app/src/main/AndroidManifest.xml";
let xml=readFileSync(filename,"utf8");
if(!/<application\b/.test(xml))throw new Error("Android application manifest section missing");
if(/android:allowBackup="(?:true|false)"/.test(xml))
  xml=xml.replace(/android:allowBackup="(?:true|false)"/,'android:allowBackup="false"');
else xml=xml.replace(/<application\b/,'<application android:allowBackup="false"');
if(!/android:allowBackup="false"/.test(xml))throw new Error("Failed to disable Android automatic app backup");
// Local finance credentials and encrypted vault must not end up in silent
// OS-level backup/synchronization. Users explicitly share encrypted files.
writeFileSync(filename,xml,"utf8");
console.log("Android app backup disabled; encrypted exports remain user-directed.");
