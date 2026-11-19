import { describe, expect, test } from "bun:test";
import { inspectLegacyBackup } from "./legacy-inspection";

const oldFile = () => ({
  meta: {
    app: "rasd", version: 1, scope: "full",
    exported_at: "2026-08-01T12:00:00Z",
    counts: { wallets: 2, expenses: 1 },
    user_id: "sensitive-id-not-for-output",
  },
  data: {
    wallets: [{ id: "1", opening_balance: 1000 }, { id: "2", opening_balance: 900 }],
    expenses: [{ id: "e1", amount: 50 }],
  },
  local: { "rasd.localPrefs.v1": { secret: "do-not-display" } },
});

describe("legacy backup v1 inspection is metadata-only", () => {
  test("summarizes old archive without returning account rows or IDs", () => {
    const report = inspectLegacyBackup(oldFile());
    expect(report).toEqual({
      scope: "full", exportedAt: "2026-08-01T12:00:00Z",
      tables: 2, records: 3, warnings: [],
    });
    expect(JSON.stringify(report)).not.toContain("sensitive-id-not-for-output");
    expect(JSON.stringify(report)).not.toContain("opening_balance");
    expect(JSON.stringify(report)).not.toContain("do-not-display");
  });
  test("detects mismatched counts and missing sections rather than treating file as restorable", () => {
    const payload = oldFile();
    payload.meta.counts.wallets = 10;
    const result = inspectLegacyBackup(payload);
    expect(result?.warnings.length).toBe(1);
  });
  test("rejects unknown tables, invalid versions and malformed rows", () => {
    expect(inspectLegacyBackup({ ...oldFile(), meta: { ...oldFile().meta, version: 2 } })).toBeNull();
    expect(inspectLegacyBackup({ ...oldFile(), data: { wallets: [], malicious_table: [] } })).toBeNull();
    expect(inspectLegacyBackup({ ...oldFile(), data: { wallets: "not an array" } })).toBeNull();
    expect(inspectLegacyBackup({ ...oldFile(), data: { wallets: [null] } })).toBeNull();
    expect(inspectLegacyBackup({ ...oldFile(), meta: { ...oldFile().meta, exported_at: "not a date" } })).toBeNull();
    expect(inspectLegacyBackup({ ...oldFile(), data: {} })).toBeNull();
  });
});
