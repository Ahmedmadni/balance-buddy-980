import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
describe("October 2026 Vite launch-editor advisory gate",()=>{
  test("keeps the patched Vite 8.1.6 in the npm lockfile",()=>{
    const j=JSON.parse(readFileSync("package.json","utf8"));
    const lock=JSON.parse(readFileSync("package-lock.json","utf8"));
    expect(j.devDependencies.vite).toBe("8.1.6");
    expect(lock.packages["node_modules/vite"]?.version).toBe("8.1.6");
  });
});
