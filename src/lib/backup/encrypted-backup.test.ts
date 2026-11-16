import { describe, expect, test } from "bun:test";
import { decryptBackup, encryptBackup, isEncryptedBackup } from "./encrypted-backup";

describe("encrypted financial backups", () => {
  test("encrypts and restores Arabic financial data without plaintext", async () => {
    const original = { format: "rasd-backup", version: 2, data: { wallets: [{ amount: 1250.5, name: "المحفظة" }] } };
    const encrypted = await encryptBackup(original, "a long and unique backup password");
    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(JSON.stringify(encrypted).includes("المحفظة")).toBe(false);
    expect(await decryptBackup(encrypted, "a long and unique backup password")).toEqual(original);
  });
  test("rejects short passwords and wrong password", async () => {
    await expect(encryptBackup({ a: 1 }, "short")).rejects.toThrow();
    const encrypted = await encryptBackup({ a: 1 }, "a long secure passphrase");
    await expect(decryptBackup(encrypted, "wrong and different phrase")).rejects.toThrow();
  });
  test("rejects tampering", async () => {
    const encrypted = await encryptBackup({ a: 1 }, "a long secure passphrase");
    await expect(decryptBackup({ ...encrypted, iv: "AAAAAAAAAAAAAAAA" }, "a long secure passphrase")).rejects.toThrow();
  });
});
