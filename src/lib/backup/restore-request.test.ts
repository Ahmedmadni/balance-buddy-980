import { describe, expect, test } from "bun:test";
import { classifyRestoreResponse, runGuardedBackupRestore } from "./restore-request";

const committed = { data: { ok: true, format: "rasd-backup", version: 2 }, error: null, status: 200 };

describe("destructive v2 restore outcome and identity guards", () => {
  test("accepts success only with the explicit SQL response marker", () => {
    expect(classifyRestoreResponse(committed)).toBe("committed");
    expect(classifyRestoreResponse({ data: null, error: null, status: 200 })).toBe("unconfirmed");
    expect(classifyRestoreResponse({ data: { ok: true }, error: null, status: 200 })).toBe("unconfirmed");
    expect(classifyRestoreResponse({ data: { ok: false, format: "rasd-backup", version: 2 }, status: 200 }))
      .toBe("unconfirmed");
  });
  test("distinguishes confirmed SQL refusal from uncertain transport failure", () => {
    expect(classifyRestoreResponse({ error: { code: "23502" }, status: 400 })).toBe("rejected");
    expect(classifyRestoreResponse({ error: { code: "P0001" }, status: 400 })).toBe("rejected");
    expect(classifyRestoreResponse({ error: { code: "PGRST301" }, status: 401 })).toBe("rejected");
    for (const status of [0, 408, 429, 500, 503, 504]) {
      expect(classifyRestoreResponse({ error: { code: "" }, status })).toBe("unconfirmed");
    }
    expect(classifyRestoreResponse({ error: { code: "" }, status: null })).toBe("unconfirmed");
  });
  test("server success must acknowledge the exact persisted operation UUID", () => {
    const operationId = "e8888888-8888-4888-8888-888888888888";
    expect(classifyRestoreResponse({ ...committed, data: {
      ok: true, format: "rasd-backup", version: 2, operation_id: operationId,
    } }, operationId)).toBe("committed");
    expect(classifyRestoreResponse(committed, operationId)).toBe("unconfirmed");
    expect(classifyRestoreResponse({ ...committed, data: {
      ok: true, format: "rasd-backup", version: 2,
      operation_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    } }, operationId)).toBe("unconfirmed");
  });

  test("refuses an account switch before calling the RPC", async () => {
    let calls = 0;
    const result = await runGuardedBackupRestore("user-A", async () => "user-B", async () => {
      calls++;
      return committed;
    });
    expect(result).toBe("blocked");
    expect(calls).toBe(0);
  });
  test("refuses a missing session, auth-network failure or missing preview identity", async () => {
    let calls = 0;
    const rpc = async () => { calls++; return committed; };
    expect(await runGuardedBackupRestore(null, async () => "user-A", rpc)).toBe("blocked");
    expect(await runGuardedBackupRestore("user-A", async () => null, rpc)).toBe("blocked");
    expect(await runGuardedBackupRestore("user-A", async () => { throw new Error("offline"); }, rpc))
      .toBe("blocked");
    expect(calls).toBe(0);
  });
  test("sends exactly one restore after identity verification", async () => {
    let calls = 0;
    expect(await runGuardedBackupRestore("user-A", async () => "user-A", async () => {
      calls++;
      return committed;
    })).toBe("committed");
    expect(calls).toBe(1);
  });
  test("does not retry when the response is lost after the server was invoked", async () => {
    let calls = 0;
    expect(await runGuardedBackupRestore("user-A", async () => "user-A", async () => {
      calls++;
      throw new TypeError("Failed to fetch");
    })).toBe("unconfirmed");
    expect(calls).toBe(1);
  });
});
