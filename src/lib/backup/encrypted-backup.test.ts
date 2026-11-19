import { describe, expect, test } from "bun:test";
import { decryptBackup, encryptBackup, isEncryptedBackup } from "./encrypted-backup";
import { BACKUP_V2_COLLECTIONS, countBackupV2Rows, validateBackupV2 } from "./v2-validation";

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
  test("round-trips a complete validated v2 archive with Arabic, numeric and date fields", async () => {
    const original = {
      format: "rasd-backup",
      version: 2,
      exported_at: "2026-11-19T06:30:00.000Z",
      profile: { display_name: "اختبار محلي", default_currency: "SAR" },
      data: Object.fromEntries(BACKUP_V2_COLLECTIONS.map((name) => [name, [] as Record<string, unknown>[]])),
    };
    original.data.wallets.push({
      id: "test-wallet-uuid", name: "المحفظة السعودية",
      currency: "SAR", opening_balance: 1250.75,
    });
    original.data.person_ledger.push({
      id: "test-entry-uuid", contact_name: "سجل اختبار",
      amount: 107.5, due_date: "2026-12-01",
    });
    const input = validateBackupV2(original);
    expect(input).not.toBeNull();
    expect(countBackupV2Rows(input!)).toBe(2);

    const envelope = await encryptBackup(input, "independent long phrase for encrypted financial archive");
    const envelopeText = JSON.stringify(envelope);
    expect(envelopeText).not.toContain("المحفظة السعودية");
    expect(envelopeText).not.toContain("سجل اختبار");
    expect(envelopeText).not.toContain("1250.75");
    const plaintext = await decryptBackup(envelope, "independent long phrase for encrypted financial archive");
    expect(validateBackupV2(plaintext)).toEqual(input);
    expect(countBackupV2Rows(validateBackupV2(plaintext)!)).toBe(2);
  });

  test("rejects modified encrypted data without exposing financial plaintext", async () => {
    const envelope = await encryptBackup({ secret: "سري للغاية" }, "independent long phrase for encrypted financial archive");
    const tampered = { ...envelope, data: (envelope.data[0] === "A" ? "B" : "A") + envelope.data.slice(1) };
    await expect(decryptBackup(tampered, "independent long phrase for encrypted financial archive"))
      .rejects.toThrow("كلمة المرور غير صحيحة أو ملف النسخة تالف");
  });

});
