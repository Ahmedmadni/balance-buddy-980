import { describe, expect, it } from "bun:test";
import { decryptRasdBackup, encryptRasdBackup, isEncryptedRasdBackup } from "./encrypted-v2";

describe("encrypted Rasd v2 local backups", () => {
  const payload = { format: "rasd-backup", version: 2, data: { wallets: [{ id: 1, balance: 0 }], investments: [] } };
  const secret = "this-is-a-long-test-password";
  it("encrypts and restores Arabic/financial content", async () => {
    const backup = await encryptRasdBackup({ ...payload, name: "رصد" }, secret);
    expect(isEncryptedRasdBackup(backup)).toBe(true);
    expect(JSON.stringify(backup)).not.toContain("wallets");
    expect(await decryptRasdBackup(backup, secret)).toEqual({ ...payload, name: "رصد" });
  });
  it("fails closed on bad password or modified ciphertext", async () => {
    const backup = await encryptRasdBackup(payload, secret);
    expect(decryptRasdBackup(backup, "not-the-same-passphrase")).rejects.toThrow();
    const at = Math.floor(backup.payload.length / 2);
    const flipped = backup.payload[at] === "A" ? "B" : "A";
    const corrupted = {
      ...backup,
      payload: backup.payload.slice(0, at) + flipped + backup.payload.slice(at + 1),
    };
    expect(decryptRasdBackup(corrupted, secret)).rejects.toThrow();
  });
  it("rejects weak passwords and malformed headers", async () => {
    expect(encryptRasdBackup(payload, "short")).rejects.toThrow();
    expect(isEncryptedRasdBackup({ format: "rasd-backup-encrypted", version: 1 })).toBe(false);
  });
});
