import { describe, expect, test } from "bun:test";
import { createVault, parseVaultFile, sealVault, setNewPassword, unlockWithPassword, unlockWithRecoveryCode } from "./crypto";
import { parseSAR, validateLedger, walletBalanceMinor } from "./ledger";

describe("Rasd fully offline AES-GCM personal vault", () => {
  test("password unlock, local accounting, and recovery key work with no server", async () => {
    const created = await createVault("Long-offline-test-password-24567!");
    expect(JSON.stringify(created.file)).not.toContain("Long-offline-test-password");
    expect(JSON.stringify(created.file)).not.toContain(created.recoveryCode);
    expect(created.recoveryCode.startsWith("RSD-")).toBe(true);
    const opened = await unlockWithPassword(parseVaultFile(JSON.stringify(created.file)), "Long-offline-test-password-24567!");
    expect(opened.ledger.wallets.length).toBe(0);
    const ledger = { ...opened.ledger,
      wallets: [{ id: "w1", name: "النقدية", openingMinor: 12345, createdAt: new Date().toISOString() }],
      entries: [{ id:"e1", walletId:"w1",kind:"expense" as const,amountMinor:345,note:"اختبار",date:"2026-11-24",createdAt:new Date().toISOString() }],
    };
    const sealed = await sealVault(created.file, opened.keyBytes, ledger);
    expect(JSON.stringify(sealed)).not.toContain("النقدية");
    const recovered = await unlockWithRecoveryCode(sealed, created.recoveryCode);
    expect(recovered.ledger.wallets[0].name).toBe("النقدية");
    expect(walletBalanceMinor(recovered.ledger.wallets[0], recovered.ledger.entries)).toBe(12000);
    const updated = await setNewPassword(sealed, recovered.keyBytes, "New-strong-offline-password-12345");
    expect((await unlockWithPassword(updated, "New-strong-offline-password-12345")).ledger.entries.length).toBe(1);
    await expect(unlockWithPassword(updated, "Long-offline-test-password-24567!")).rejects.toThrow();
  }, 120000);

  test("wrong password, recovery code and tampered ciphertext fail closed", async () => {
    const v = await createVault("Another-secure-password-12345!");
    await expect(unlockWithPassword(v.file, "wrong-password-123")).rejects.toThrow();
    await expect(unlockWithRecoveryCode(v.file, "RSD-not-a-real-recovery-code")).rejects.toThrow();
    const changed = JSON.parse(JSON.stringify(v.file));
    changed.vault.data = changed.vault.data.slice(0,-1) + (changed.vault.data.endsWith("A") ? "B" : "A");
    await expect(unlockWithPassword(changed, "Another-secure-password-12345!")).rejects.toThrow();
    expect(() => parseVaultFile('{"format":"not-rasd"}')).toThrow();
  }, 120000);

  test("no floating point SAR amounts, dangling references or duplicate IDs", () => {
    expect(parseSAR("١٢٣.٤٥")).toBe(12345);
    expect(parseSAR("12.3")).toBe(1230);
    expect(() => parseSAR("12.345")).toThrow();
    expect(() => parseSAR("-1")).toThrow();
    expect(() => validateLedger({ schema: "rasd-ledger-v1",currency:"SAR", wallets:[],
      entries:[{id:"e",walletId:"missing",kind:"expense",amountMinor:1,note:"",date:"2026-11-24",createdAt:"today"}],debts:[] })).toThrow();
  });
});
