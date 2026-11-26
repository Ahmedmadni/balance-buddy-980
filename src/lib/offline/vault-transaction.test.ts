import { describe, expect, test } from "bun:test";
import {
  commitVaultFiles, inspectVaultFiles, promoteVaultCandidate,
  type VaultFileName, type VaultFiles,
} from "./vault-transaction";
import type { RasdVaultFile } from "./crypto";

function fixture(rev: number): RasdVaultFile {
  const encrypted = (token: string) => ({ iv: "AAAAAAAAAAAAAAAA", data: token });
  return {
    format: "rasd-android-local-v1", version: 1,
    createdAt: "2026-11-24T00:00:00Z",
    password: { salt: "AAAAAAAAAAAAAAAAAAAAAA", iterations: 600000, wrappedKey: encrypted("WRAPPED") },
    recovery: encrypted("RECOVERY"),
    vault: encrypted("CIPHERTEXT" + rev),
  };
}
function memory() {
  const map = new Map<VaultFileName,string>();
  let sabotage: ((name: VaultFileName, content: string)=>"before"|"after"|null) | null = null;
  const io: VaultFiles = {
    read: async name => map.get(name) ?? null,
    write: async (name, content) => {
      const action = sabotage?.(name,content);
      if (action === "before") throw new Error("simulated filesystem failure before write");
      map.set(name,content);
      if (action === "after") {
        map.set(name, content.slice(0, Math.max(1,content.length/2)));
        throw new Error("simulated Android process death during file write");
      }
    },
    remove: async name => { map.delete(name); },
  };
  return {
    io,
    map,
    fail: (fn: (name:VaultFileName,content:string)=>"before"|"after"|null) => { sabotage=fn; },
    clear: () => { sabotage=null; },
  };
}
describe("Rasd local vault crash recovery (file-only, no silent rollback)", () => {
  test("new install remains empty; a verified first save becomes committed", async () => {
    const s=memory();
    expect((await inspectVaultFiles(s.io)).kind).toBe("empty");
    await commitVaultFiles(s.io,fixture(1));
    const result=await inspectVaultFiles(s.io);
    expect(result.kind).toBe("ready");
    expect(s.map.has("pending")).toBe(false);
    expect(s.map.has("previous")).toBe(false);
  });

  test("normal second commit keeps prior encrypted data as recovery evidence", async () => {
    const s=memory();
    await commitVaultFiles(s.io,fixture(1));
    const first=s.map.get("primary");
    await commitVaultFiles(s.io,fixture(2));
    expect(s.map.get("previous")).toBe(first);
    expect(s.map.get("primary")).not.toBe(first);
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
  });

  test("interrupt BEFORE main write exposes both pending and previous without automatic recovery", async () => {
    const s=memory();
    await commitVaultFiles(s.io,fixture(1));
    s.fail(name=>name==="primary"?"before":null);
    await expect(commitVaultFiles(s.io,fixture(2))).rejects.toThrow();
    const snapshots=await inspectVaultFiles(s.io);
    expect(snapshots.kind).toBe("recovery_required");
    if (snapshots.kind !== "recovery_required") throw Error("expected recoverable");
    expect(snapshots.candidates.map(c=>c.source)).toEqual(["primary","pending","previous"]);
    s.clear();
    const newCandidate=snapshots.candidates.find(c=>c.source==="pending")!;
    await promoteVaultCandidate(s.io,"pending",newCandidate.file);
    expect(s.map.get("primary")).toContain("CIPHERTEXT2");
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
  });

  test("truncated committed ciphertext leaves previous and pending for explicit authentication", async () => {
    const s=memory();
    await commitVaultFiles(s.io,fixture(1));
    s.fail(name=>name==="primary"?"after":null);
    await expect(commitVaultFiles(s.io,fixture(2))).rejects.toThrow();
    const snapshots=await inspectVaultFiles(s.io);
    expect(snapshots.kind).toBe("recovery_required");
    if (snapshots.kind !== "recovery_required") throw Error("expected recovery");
    expect(snapshots.damagedPrimary).toBe(true);
    expect(snapshots.candidates.map(c=>c.source)).toEqual(["pending","previous"]);
    s.clear();
    await promoteVaultCandidate(s.io,"previous",snapshots.candidates[1].file);
    expect(s.map.get("primary")).toContain("CIPHERTEXT1");
    expect(s.map.get("previous")).toContain("CIPHERTEXT1");
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
  });

  test("a crashed first-ever commit MUST NOT offer creating an empty vault again", async () => {
    const s=memory();
    s.fail(name=>name==="primary"?"before":null);
    await expect(commitVaultFiles(s.io,fixture(1))).rejects.toThrow();
    expect((await inspectVaultFiles(s.io)).kind).toBe("recovery_required");
    s.clear();
    const candidate=await inspectVaultFiles(s.io);
    if(candidate.kind!=="recovery_required")throw Error("no candidate");
    await promoteVaultCandidate(s.io,"pending",candidate.candidates[0].file);
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
  });

  test("a preexisting unfinished draft prevents another write from overwriting it", async () => {
    const s=memory();
    await commitVaultFiles(s.io,fixture(1));
    s.map.set("pending",JSON.stringify(fixture(2)));
    await expect(commitVaultFiles(s.io,fixture(3))).rejects.toThrow("غير مكتملة");
    expect(s.map.get("pending")).toContain("CIPHERTEXT2");
    expect(s.map.get("primary")).toContain("CIPHERTEXT1");
  });

  test("interrupted PREVIOUS backup leaves primary untouched and owner can select it", async () => {
    const s=memory();
    await commitVaultFiles(s.io,fixture(1));
    s.fail(name=>name==="previous"?"after":null);
    await expect(commitVaultFiles(s.io,fixture(2))).rejects.toThrow();
    expect(s.map.get("primary")).toContain("CIPHERTEXT1");
    const inspection=await inspectVaultFiles(s.io);
    expect(inspection.kind).toBe("recovery_required");
    s.clear();
    if (inspection.kind!=="recovery_required")throw Error("missing");
    await promoteVaultCandidate(s.io,"primary",inspection.candidates.find(x=>x.source==="primary")!.file);
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
  });

  test("stale draft identical to committed file is not an unfinished transaction", async () => {
    const s=memory();
    await commitVaultFiles(s.io,fixture(1));
    s.map.set("pending",s.map.get("primary")!);
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
    await commitVaultFiles(s.io,fixture(2));
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
  });

  test("damaged primary with no other valid file must not reset owner finances", async () => {
    const s=memory();
    s.map.set("primary","{damaged json");
    expect((await inspectVaultFiles(s.io)).kind).toBe("damaged");
    await expect(commitVaultFiles(s.io,fixture(3))).rejects.toThrow();
  });

  test("candidate modified between confirmation and promotion is refused", async () => {
    const s=memory();
    await commitVaultFiles(s.io,fixture(1));
    s.map.set("pending",JSON.stringify(fixture(2)));
    const choice=(await inspectVaultFiles(s.io));
    if(choice.kind!=="recovery_required")throw Error("no recovery");
    const snap=choice.candidates.find(x=>x.source==="pending")!;
    s.map.set("pending",JSON.stringify(fixture(3)));
    await expect(promoteVaultCandidate(s.io,"pending",snap.file)).rejects.toThrow("تغيّر");
    expect(s.map.get("primary")).toContain("CIPHERTEXT1");
  });

  test("empty pending file is evidence of interrupted write, not a completed commit", async () => {
    const s = memory();
    await commitVaultFiles(s.io, fixture(1));
    s.map.set("pending", "");
    const inspection = await inspectVaultFiles(s.io);
    expect(inspection.kind).toBe("recovery_required");
    await expect(commitVaultFiles(s.io, fixture(2))).rejects.toThrow();
  });

  test("missing primary with surviving previous snapshot blocks new commits", async () => {
    const s = memory();
    await commitVaultFiles(s.io, fixture(1));
    await commitVaultFiles(s.io, fixture(2));
    s.map.delete("primary");
    const original = s.map.get("previous");
    expect((await inspectVaultFiles(s.io)).kind).toBe("recovery_required");
    await expect(commitVaultFiles(s.io, fixture(3))).rejects.toThrow();
    expect(s.map.get("previous")).toBe(original);
    expect(s.map.has("primary")).toBe(false);
    expect(s.map.has("pending")).toBe(false);
  });

  test("selecting the only surviving primary never risks truncating it again", async () => {
    const s = memory();
    await commitVaultFiles(s.io, fixture(1));
    const original = s.map.get("primary");
    s.map.set("pending", "{broken");
    s.fail(name => name === "primary" ? "after" : null);
    const inspection = await inspectVaultFiles(s.io);
    if (inspection.kind !== "recovery_required") throw Error("expected recovery");
    expect(inspection.candidates.map(c => c.source)).toEqual(["primary"]);
    await promoteVaultCandidate(s.io, "primary", inspection.candidates[0].file);
    expect(s.map.get("primary")).toBe(original);
    expect(s.map.has("pending")).toBe(false);
    expect((await inspectVaultFiles(s.io)).kind).toBe("ready");
  });

});
