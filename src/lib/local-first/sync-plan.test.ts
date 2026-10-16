import { describe, expect, test } from "bun:test";
import { planConservativeSync, type SyncItem } from "./sync-plan";
const row = (id: string, rev: string, digest = rev, deleted = false): SyncItem =>
  ({ id, stamp: { revision: rev, digest, deleted } });
describe("local-first finance sync must not silently overwrite", () => {
  test("new guest item uploads only if no prior synced version exists", () => {
    expect(planConservativeSync([row("wallet-1","local-a")], []))
      .toEqual([{ id:"wallet-1", action:"upload", reason:"new_record" }]);
  });
  test("new cloud item downloads to empty device after first account link", () => {
    expect(planConservativeSync([], [row("wallet-1","cloud-a")])[0]?.action).toBe("download");
  });
  test("two independent edits to a synced money record require manual resolution", () => {
    const old = row("debt-1","base");
    expect(planConservativeSync([row("debt-1","local")],[row("debt-1","remote")],[old])[0]?.action)
      .toBe("conflict");
  });
  test("cloud-only update is safe if device still has exact last acknowledged revision", () => {
    const old=row("wallet-1","base");
    expect(planConservativeSync([old],[row("wallet-1","server")],[old])[0]?.action).toBe("download");
  });
  test("device-only update uploads when server revision is unchanged", () => {
    const old=row("wallet-1","base");
    expect(planConservativeSync([row("wallet-1","device")],[old],[old])[0]?.action).toBe("upload");
  });
  test("tombstone propagates only if opposite side has not changed", () => {
    const old=row("expense-1","base");
    expect(planConservativeSync([row("expense-1","delete", "deleted", true)],[old],[old])[0]?.action)
      .toBe("upload");
    expect(planConservativeSync([row("expense-1","delete","deleted",true)],[row("expense-1","edit")],[old])[0]?.action)
      .toBe("conflict");
  });
  test("missing record after sync must not be interpreted as deletion or new data", () => {
    expect(planConservativeSync([], [row("ledger-1","remote")],[row("ledger-1","old")])[0]?.action)
      .toBe("conflict");
  });
  test("same revision with tampered financial payload digest is a conflict", () => {
    expect(planConservativeSync([row("x","v1","A")],[row("x","v1","B")])[0]?.action)
      .toBe("conflict");
  });
  test("duplicate identifiers are rejected instead of silently deduplicated", () => {
    expect(()=>planConservativeSync([row("x","a"),row("x","b")],[]))
      .toThrow(/Duplicate/);
  });
});
