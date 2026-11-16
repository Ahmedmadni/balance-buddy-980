import { describe, expect, test } from "bun:test";
import { BACKUP_V2_COLLECTIONS, countBackupV2Rows, isBackupJsonFile, validateBackupV2 } from "./v2-validation";

function validBackup() {
  return {
    format: "rasd-backup",
    version: 2,
    exported_at: "2026-11-16T06:00:00Z",
    profile: {},
    data: Object.fromEntries(BACKUP_V2_COLLECTIONS.map((key) => [key, []])),
  };
}

describe("Backup v2 financial restore preflight", () => {
  test("accepts all required empty collections as a deliberate empty backup", () => {
    const valid = validBackup();
    const parsed = validateBackupV2(valid);
    expect(parsed).toBe(valid);
    expect(countBackupV2Rows(parsed!)).toBe(0);
  });
  test("rejects missing collections rather than silently treating data as empty", () => {
    const invalid = validBackup();
    delete (invalid.data as Record<string, unknown>).wallets;
    expect(validateBackupV2(invalid)).toBeNull();
    expect(validateBackupV2({ format: "rasd-backup", version: 2, data: {} })).toBeNull();
  });
  test("rejects malformed rows, collection types, forbidden derived data and identities", () => {
    const baseline = validBackup();
    const patches = [
      { data: { ...baseline.data, wallets: "not rows" } },
      { data: { ...baseline.data, wallets: [null] } },
      { data: { ...baseline.data, wallets: [12] } },
      { data: { ...baseline.data, wallets: [{ user_id: "foreign" }] } },
      { data: { ...baseline.data, transactions: [] } },
      { data: { ...baseline.data, attachments: [] } },
      { data: { ...baseline.data, system_events: [] } },
      { profile: { id: "impersonation" } },
      { profile: { user_id: "foreign" } },
    ];
    for (const patch of patches) expect(validateBackupV2({ ...baseline, ...patch })).toBeNull();
  });
  test("rejects unsupported versions and invalid export timestamps", () => {
    const valid = validBackup();
    expect(validateBackupV2({ ...valid, version: 1 })).toBeNull();
    expect(validateBackupV2({ ...valid, format: "other" })).toBeNull();
    expect(validateBackupV2({ ...valid, exported_at: {} })).toBeNull();
    expect(validateBackupV2({ ...valid, exported_at: "not-a-date" })).toBeNull();
  });
  test("computes record count for review before destructive restore", () => {
    const valid = validBackup();
    valid.data.wallets.push({ id: "wallet-1" }, { id: "wallet-2" });
    valid.data.person_ledger.push({ id: "entry-1" });
    expect(countBackupV2Rows(validateBackupV2(valid)!)).toBe(3);
  });
  test("recognizes JSON files only", () => {
    expect(isBackupJsonFile("BACKUP.JSON")).toBe(true);
    expect(isBackupJsonFile("backup.csv")).toBe(false);
    expect(isBackupJsonFile("backup.json.exe")).toBe(false);
  });
});
