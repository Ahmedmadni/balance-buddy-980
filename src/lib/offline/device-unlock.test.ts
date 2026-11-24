import { describe, expect, test } from "bun:test";
import {
  createVault, sealVault, setNewPassword, unlockWithDeviceKey,
} from "./crypto";
import { getDeviceVaultTag, probeDeviceUnlock, supportsDeviceUnlockPlatform } from "./device-unlock";

describe("Rasd Android Keystore-bound optional unlock", () => {
  test("vault binding remains stable across financial edits and password changes", async () => {
    const created = await createVault("Strong-password-for-local-vault-123!");
    const initialTag = await getDeviceVaultTag(created.file);
    expect(initialTag).toMatch(/^[a-f0-9]{64}$/);
    const editedFile = await sealVault(created.file, created.keyBytes, {
      ...created.ledger,
      wallets: [{ id:"wallet", name:"محفظة اختبار", openingMinor:12345, createdAt:"2026-11-24T12:00:00Z" }],
    });
    const passwordChangedFile = await setNewPassword(
      editedFile, created.keyBytes, "New-password-for-local-vault-987!"
    );
    expect(await getDeviceVaultTag(editedFile)).toBe(initialTag);
    expect(await getDeviceVaultTag(passwordChangedFile)).toBe(initialTag);
    const differentVault = await createVault("Different-password-xyz-987!");
    expect(await getDeviceVaultTag(differentVault.file)).not.toBe(initialTag);
  }, 120000);

  test("native-unwrapped key never bypasses vault AES-GCM integrity checks", async () => {
    const owner = await createVault("Owner-master-password-123456!");
    const intruder = await createVault("Other-master-password-876543!");
    const unlocked = await unlockWithDeviceKey(owner.file, owner.keyBytes);
    expect(unlocked.ledger.currency).toBe("SAR");
    expect(unlocked.keyBytes).not.toBe(owner.keyBytes); // zeroizing bridge buffer is safe
    owner.keyBytes.fill(0);
    expect(unlocked.keyBytes.some(byte => byte !== 0)).toBe(true);
    await expect(unlockWithDeviceKey(owner.file, intruder.keyBytes)).rejects.toThrow();
    await expect(unlockWithDeviceKey(owner.file, new Uint8Array(4))).rejects.toThrow();
  }, 120000);

  test("plain browser cannot probe or enable device unlock", async () => {
    expect(supportsDeviceUnlockPlatform()).toBe(false);
    const vault = await createVault("No-native-bridge-password-8888");
    expect(await probeDeviceUnlock(vault.file)).toEqual({
      supported: false, enabled: false, matchesVault: false,
    });
  }, 120000);
});
