import { Capacitor, registerPlugin } from "@capacitor/core";
import type { RasdVaultFile } from "./crypto";

export interface DeviceUnlockProbe {
  supported: boolean;
  enabled: boolean;
  matchesVault: boolean;
}
interface DeviceUnlockBridge {
  probe(options: { vaultTag: string }): Promise<DeviceUnlockProbe>;
  enable(options: { vaultTag: string; keyBase64: string }): Promise<void>;
  unlock(options: { vaultTag: string }): Promise<{ keyBase64: string }>;
  disable(): Promise<void>;
}

const bridge = registerPlugin<DeviceUnlockBridge>("RasdDeviceUnlock");
const encoder = new TextEncoder();
const toHex = (array: Uint8Array) =>
  Array.from(array, b => b.toString(16).padStart(2, "0")).join("");

/**
 * Identifies the durable vault data key by its random recovery wrapping,
 * which stays constant after password rotation and normal ledger edits.
 * Never hash names, PINs, biometrics, or financial records.
 */
export async function getDeviceVaultTag(file: RasdVaultFile): Promise<string> {
  const proof = encoder.encode(JSON.stringify({
    iv: file.recovery.iv,
    data: file.recovery.data,
  }));
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", proof)));
}
export function supportsDeviceUnlockPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
export async function probeDeviceUnlock(file: RasdVaultFile): Promise<DeviceUnlockProbe> {
  if (!supportsDeviceUnlockPlatform()) return {
    supported: false, enabled: false, matchesVault: false,
  };
  try {
    const status = await bridge.probe({ vaultTag: await getDeviceVaultTag(file) });
    return {
      supported: status.supported === true,
      enabled: status.enabled === true,
      matchesVault: status.matchesVault === true,
    };
  } catch {
    return { supported: false, enabled: false, matchesVault: false };
  }
}

function encodeKey(raw: Uint8Array): string {
  if (raw.length !== 32) throw new Error("مفتاح الخزنة غير صالح.");
  // AES DEK passes once through the trusted on-device Capacitor bridge.
  // Android Keystore encrypts it before persistence and does not return it
  // without a successful OS-authenticated CryptoObject operation.
  let source = "";
  for (const byte of raw) source += String.fromCharCode(byte);
  return btoa(source);
}
function decodeKey(text: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(text)) {
    // Standard base64 encoding of 32 random bytes has 44 chars, one '='.
    // Verify both length and decoded bytes below; generic encoded keys
    // remain accepted on Android versions with canonical Base64 output.
    if (!/^[A-Za-z0-9+/]{43}=$/.test(text))
      throw new Error("رد مفتاح Android غير صالح.");
  }
  const result = Uint8Array.from(atob(text), char => char.charCodeAt(0));
  if (result.length !== 32) throw new Error("طول مفتاح الجهاز غير صالح.");
  return result;
}

export async function enableDeviceUnlock(file: RasdVaultFile, rawKey: Uint8Array): Promise<void> {
  if (!supportsDeviceUnlockPlatform()) throw new Error("هذه الميزة متاحة في Android فقط.");
  await bridge.enable({ vaultTag: await getDeviceVaultTag(file), keyBase64: encodeKey(rawKey) });
}

export async function unlockDeviceKey(file: RasdVaultFile): Promise<Uint8Array> {
  if (!supportsDeviceUnlockPlatform()) throw new Error("هذه الميزة متاحة في Android فقط.");
  const result = await bridge.unlock({ vaultTag: await getDeviceVaultTag(file) });
  return decodeKey(result.keyBase64);
}

export async function disableDeviceUnlock(): Promise<void> {
  if (!supportsDeviceUnlockPlatform()) throw new Error("هذه الميزة متاحة في Android فقط.");
  await bridge.disable();
}
