import {existsSync,renameSync} from "node:fs";
const file="dist/client/android-local.html";
if(!existsSync(file))throw new Error("Missing native offline HTML");
renameSync(file,"dist/client/index.html");
