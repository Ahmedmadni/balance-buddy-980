import { describe, expect, test } from "bun:test";
import { exportUserData, importUserData, downloadJSON, downloadCSVZip, downloadXLSX, type BackupBundle } from "./engine";

const sample: BackupBundle = {
  meta: {
    app: "rasd", version: 1, scope: "full",
    exported_at: "2026-08-01T12:00:00Z",
    counts: { wallets: 1 },
  },
  data: { wallets: [{ id: "old-test", amount: 123 }] },
};

describe("legacy v1 safeguards", () => {
  test("no new plaintext v1 server export may start", async () => {
    await expect(exportUserData("full")).rejects.toThrow("v1");
  });
  test("old partial replace/merge engine may not mutate any database tables", async () => {
    await expect(importUserData(sample, { mode: "replace" })).rejects.toThrow("v1");
    await expect(importUserData(sample, { mode: "merge" })).rejects.toThrow("v1");
  });
  test("preview-only call never starts an import", async () => {
    expect(await importUserData(sample, { mode: "preview" })).toEqual({
      inserted: {}, updated: {}, skipped: {}, errors: [],
    });
  });
  test("all legacy plaintext file writer functions are disabled", () => {
    expect(() => downloadJSON(sample)).toThrow("v1");
    expect(() => downloadCSVZip(sample)).toThrow("v1");
    expect(() => downloadXLSX(sample)).toThrow("v1");
  });
});
