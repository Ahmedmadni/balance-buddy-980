import { describe, expect, test } from "bun:test";
import {
  RESTORE_HOLD_PREFIX,
  acknowledgeRestoreHold,
  readRestoreHold,
  reserveRestoreHold,
  settleRestoreHold,
  type RestoreHoldStorage,
} from "./restore-hold";
import { runGuardedBackupRestore } from "./restore-request";

function storage(): RestoreHoldStorage {
  const rows = new Map<string, string>();
  return {
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => { rows.set(key, value); },
    removeItem: (key) => { rows.delete(key); },
  };
}

const ok = { data: { ok: true, format: "rasd-backup", version: 2 }, error: null, status: 200 };

describe("durable v2 restore journal", () => {
  test("holds before a destructive RPC and survives re-mount / re-open", async () => {
    const store = storage();
    let calls = 0;
    const outcome = await runGuardedBackupRestore(
      "A", async () => "A",
      async () => { calls++; expect(readRestoreHold(store, "A")).toBe("pending"); throw new Error("connection lost"); },
      {
        beforeSend: () => reserveRestoreHold(store, "A"),
        onOutcome: (result) => settleRestoreHold(store, "A", result),
      },
    );
    expect(outcome).toBe("unconfirmed");
    expect(calls).toBe(1);
    expect(readRestoreHold(store, "A")).toBe("unconfirmed");
    expect(reserveRestoreHold(store, "A")).toBe(false);
    expect(readRestoreHold(store, "B")).toBe(null);
  });

  test("a crash while RPC is in-flight leaves a durable pending hold", () => {
    const store = storage();
    expect(reserveRestoreHold(store, "A")).toBe(true);
    expect(readRestoreHold(store, "A")).toBe("pending");
    expect(reserveRestoreHold(store, "A")).toBe(false);
    expect(reserveRestoreHold(store, "B")).toBe(true);
  });

  test("known SQL success or rejection clears the hold", () => {
    const store = storage();
    reserveRestoreHold(store, "A");
    settleRestoreHold(store, "A", "committed");
    expect(readRestoreHold(store, "A")).toBe(null);
    reserveRestoreHold(store, "A");
    settleRestoreHold(store, "A", "rejected");
    expect(readRestoreHold(store, "A")).toBe(null);
  });

  test("a blocked auth check never reserves a journal entry", async () => {
    const store = storage();
    let sends = 0;
    const result = await runGuardedBackupRestore(
      "A", async () => "B", async () => { sends++; return ok; },
      { beforeSend: () => reserveRestoreHold(store, "A") },
    );
    expect(result).toBe("blocked");
    expect(sends).toBe(0);
    expect(readRestoreHold(store, "A")).toBe(null);
  });

  test("locked or unavailable storage fails closed instead of invoking SQL", async () => {
    const blockedStorage: RestoreHoldStorage = {
      getItem: () => { throw new Error("storage disabled"); },
      setItem: () => { throw new Error("storage disabled"); },
      removeItem: () => { throw new Error("storage disabled"); },
    };
    expect(readRestoreHold(blockedStorage, "A")).toBe("unavailable");
    let sends = 0;
    expect(await runGuardedBackupRestore(
      "A", async () => "A", async () => { sends++; return ok; },
      { beforeSend: () => reserveRestoreHold(blockedStorage, "A") },
    )).toBe("blocked");
    expect(sends).toBe(0);
  });

  test("only explicit acknowledgment removes an uncertain hold", () => {
    const store = storage();
    reserveRestoreHold(store, "A");
    settleRestoreHold(store, "A", "unconfirmed");
    expect(acknowledgeRestoreHold(store, "A")).toBe(true);
    expect(readRestoreHold(store, "A")).toBe(null);
  });

  test("corrupted journal cannot be silently overridden", () => {
    const store = storage();
    store.setItem(`${RESTORE_HOLD_PREFIX}A`, "invalid");
    expect(readRestoreHold(store, "A")).toBe("unavailable");
    expect(reserveRestoreHold(store, "A")).toBe(false);
  });
});
