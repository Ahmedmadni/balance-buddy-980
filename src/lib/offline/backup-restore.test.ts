import { describe, expect, test } from "bun:test";
import { createVault, sealVault, unlockWithPassword } from "./crypto";
import { previewEncryptedBackup, restoreVerifiedBackup, type RestoreRequest } from "./backup-restore";
import type { VaultFiles, VaultFileName } from "./vault-transaction";

const master = "Original-master-CI-2026!";
const backupPassword = "Backup-master-CI-2026!";
async function fixture() {
  const current = await createVault(master);
  const backup = await createVault(backupPassword);
  const target = await sealVault(backup.file, backup.keyBytes, {
    ...backup.ledger, wallets:[{id:"test",name:"Synthetic wallet",openingMinor:123456,createdAt:"2026-11-26T00:00:00Z"}],
  });
  const files = new Map<VaultFileName,string>([["primary",JSON.stringify(current.file)]]);
  let safe: string | null = null;
  let writes = 0, revoked = 0;
  const io: VaultFiles = {
    read: async name => files.get(name) ?? null,
    write: async (name,value) => {writes++;files.set(name,value);},
    remove: async name => {files.delete(name);},
  };
  const safety = {read:async()=>safe,write:async(value:string)=>{safe=value;}};
  const credential = {kind:"password" as const,secret:backupPassword};
  const request: RestoreRequest = {
    backup:target,preview:await previewEncryptedBackup(target,credential),credential,
    expectedCurrent:current.file,currentMaster:master,confirmation:"استبدال",
    stillAuthorized:()=>true,revokeShortcuts:async()=>{revoked++;},
  };
  current.keyBytes.fill(0);backup.keyBytes.fill(0);
  return { current, target, files, io, safety, request, backupRecovery:backup.recoveryCode,
    writes:()=>writes,revoked:()=>revoked };
}

describe("Authenticated backup restore",()=>{
  test("preview decrypts with recovery code and shows balance without returning key",async()=>{
    const f=await fixture();
    const preview=await previewEncryptedBackup(f.target,{kind:"recovery",secret:f.backupRecovery});
    expect(preview.summary).toEqual({wallets:1,entries:0,debts:0,balanceMinor:123456,currency:"SAR"});
    expect(preview).toEqual(f.request.preview);
    expect(Object.keys(preview).sort()).toEqual(["fingerprint","summary"]);
    await expect(previewEncryptedBackup(f.target,{kind:"password",secret:"wrong"})).rejects.toThrow();
  },120000);
  test("wrong current password cannot replace an existing vault",async()=>{
    const f=await fixture();
    await expect(restoreVerifiedBackup(f.io,f.safety,{...f.request,currentMaster:"wrong"})).rejects.toThrow();
    expect(f.writes()).toBe(0);expect(f.revoked()).toBe(0);expect(await f.safety.read()).toBeNull();
  },120000);
  test("changed preview, missing confirmation and stale session never write",async()=>{
    const f=await fixture();
    for(const request of [
      {...f.request,preview:{...f.request.preview,fingerprint:"wrong"}},
      {...f.request,confirmation:""},
      {...f.request,stillAuthorized:()=>false},
      {...f.request,expectedCurrent:null},
    ]) await expect(restoreVerifiedBackup(f.io,f.safety,request)).rejects.toThrow();
    expect(f.writes()).toBe(0);expect(f.revoked()).toBe(0);
  },120000);
  test("restore keeps an independent encrypted safety copy through later commits",async()=>{
    const f=await fixture();
    const opened=await restoreVerifiedBackup(f.io,f.safety,f.request);
    expect(opened.ledger.wallets[0].openingMinor).toBe(123456);
    expect(f.files.get("primary")).toBe(JSON.stringify(f.target));
    expect(await f.safety.read()).toBe(JSON.stringify(f.current.file));
    expect(f.revoked()).toBe(1);
    const safety=await unlockWithPassword(JSON.parse((await f.safety.read())!),master);
    expect(safety.ledger.wallets.length).toBe(0);
    opened.keyBytes.fill(0);safety.keyBytes.fill(0);
  },120000);
  test("failed safety readback or existing different safety copy blocks replacement",async()=>{
    const f=await fixture();
    await expect(restoreVerifiedBackup(f.io,{read:async()=>null,write:async()=>{}},f.request)).rejects.toThrow();
    await f.safety.write(JSON.stringify(f.target));
    await expect(restoreVerifiedBackup(f.io,f.safety,f.request)).rejects.toThrow();
    expect(f.writes()).toBe(0);expect(f.revoked()).toBe(0);
  },120000);
  test("first install restores an authenticated backup without existing master or safety copy",async()=>{
    const f=await fixture();
    f.files.clear();
    const opened=await restoreVerifiedBackup(f.io,f.safety,{...f.request,expectedCurrent:null,currentMaster:""});
    expect(opened.ledger.wallets.length).toBe(1);expect(await f.safety.read()).toBeNull();
    opened.keyBytes.fill(0);
  },120000);
});
