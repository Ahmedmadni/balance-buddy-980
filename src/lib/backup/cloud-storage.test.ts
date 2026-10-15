import { describe, expect, test } from "bun:test";
import { backupObjectPath, isValidBackupObjectName, MAX_CLOUD_BACKUP_BYTES } from "./cloud-storage";
describe("cloud backup object paths", () => {
  const uid = "00000000-0000-4000-8000-000000000001";
  const good = "rasd-20261015T114422-00000000-0000-4000-8000-000000000002.json";
  test("uploads use per-user private prefixes", () => {
    expect(isValidBackupObjectName(good)).toBe(true);
    expect(backupObjectPath(uid, good)).toBe(`${uid}/${good}`);
  });
  test("path traversal, another folder, and other file names are rejected", () => {
    for (const bad of ["../secret.json", "other/backup.json", "/backup.json", "anything.json"]) {
      expect(isValidBackupObjectName(bad)).toBe(false);
      expect(() => backupObjectPath(uid, bad)).toThrow();
    }
    expect(() => backupObjectPath("../another-user",good)).toThrow();
  });
  test("backup size bound is enforced", () => expect(MAX_CLOUD_BACKUP_BYTES).toBe(26214400));
});
