import { describe, expect, test } from "bun:test";
import { BACKUP_PAGE_SIZE, readAllBackupRows } from "./paged-export";

describe("legacy backup export never silently truncates", () => {
  test("paginates more than 1,000 rows and collects all of them", async () => {
    const expected = Array.from({ length: 1251 }, (_, id) => ({ id }));
    const visited: number[] = [];
    const result = await readAllBackupRows(async (from, to) => {
      visited.push(from);
      return { data: expected.slice(from, to + 1), count: expected.length };
    }, "wallet_transactions");
    expect(result).toEqual(expected);
    expect(visited).toEqual([0, BACKUP_PAGE_SIZE, 1000]);
  });
  test("handles a truly empty table", async () => {
    expect(await readAllBackupRows(async () => ({ data: [], count: 0 }), "wallets")).toEqual([]);
  });
  test("aborts rather than exporting fewer rows than the count", async () => {
    await expect(readAllBackupRows(async () => ({ data: [], count: 10 }), "wallets"))
      .rejects.toThrow(/غير مكتملة/);
  });
  test("aborts if row count changes between pages", async () => {
    await expect(readAllBackupRows(async (from, to) => ({
      data: Array.from({ length: Math.min(500, 600 - from) }, (_, i) => ({ id: i + from })),
      count: from ? 601 : 600,
    }), "wallets")).rejects.toThrow(/تغير عدد/);
  });
  test("aborts on permission failures and absent exact count", async () => {
    await expect(readAllBackupRows(async () => ({ data: null, count: null, error: { message: "denied" } }), "wallets"))
      .rejects.toThrow(/denied/);
    await expect(readAllBackupRows(async () => ({ data: [], count: null }), "wallets"))
      .rejects.toThrow(/تعذر التحقق/);
  });
  test("rejects unsupported page size", async () => {
    await expect(readAllBackupRows(async () => ({ data: [], count: 0 }), "wallets", 5001))
      .rejects.toThrow(/غير صالح/);
  });
});
