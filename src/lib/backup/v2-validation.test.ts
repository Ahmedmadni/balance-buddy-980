import { describe, expect, test } from "bun:test";
import { isBackupJsonFile, validateBackupV2 } from "./v2-validation";

describe("Backup v2 input boundary", () => {
  test("accepts only rasd-backup version 2 with object data", () => {
    const valid = { format: "rasd-backup", version: 2, data: {} };
    expect(validateBackupV2(valid)).toBe(valid);
    for (const invalid of [null, [], "backup", { ...valid, format: "other" },
      { ...valid, version: 1 }, { ...valid, data: [] }, { ...valid, data: null },
      { format: "rasd-backup", version: 2 }]) {
      expect(validateBackupV2(invalid)).toBeNull();
    }
  });
  test("accepts a valid optional export date and rejects unsafe date types", () => {
    const base = { format: "rasd-backup", version: 2, data: {} };
    expect(validateBackupV2({ ...base, exported_at: "2026-10-26T06:01:00Z" })).not.toBeNull();
    expect(validateBackupV2({ ...base, exported_at: {} })).toBeNull();
    expect(validateBackupV2({ ...base, exported_at: "not-a-date" })).toBeNull();
  });
  test("accepts JSON files only before reading their contents", () => {
    expect(isBackupJsonFile("rasd-backup.json")).toBe(true);
    expect(isBackupJsonFile("BACKUP.JSON")).toBe(true);
    expect(isBackupJsonFile("backup.csv")).toBe(false);
    expect(isBackupJsonFile("backup.json.exe")).toBe(false);
  });
});