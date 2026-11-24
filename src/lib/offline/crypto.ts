import { emptyLedger, validateLedger, type LocalLedger } from "./ledger";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const KDF_ITERATIONS = 600000;
const MIN_PASSWORD_LENGTH = 12;
const MAX_ENVELOPE_LENGTH = 32 * 1024 * 1024;

export interface EncryptedPart { iv: string; data: string; }
export interface RasdVaultFile {
  format: "rasd-android-local-v1";
  version: 1;
  createdAt: string;
  password: { salt: string; iterations: number; wrappedKey: EncryptedPart };
  recovery: EncryptedPart;
  vault: EncryptedPart;
}
export interface OpenedVault { keyBytes: Uint8Array; ledger: LocalLedger; }
export interface CreatedVault extends OpenedVault {
  file: RasdVaultFile; recoveryCode: string;
}

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const encode64 = (bytes: Uint8Array) => {
  let s = "";
  for (const n of bytes) s += String.fromCharCode(n);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const decode64 = (text: string) => {
  if (!/^[\w-]+$/.test(text) || text.length > MAX_ENVELOPE_LENGTH) throw new Error("صيغة رمز الاسترداد غير سليمة.");
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
const importAes = (raw: Uint8Array) => crypto.subtle.importKey(
  "raw", raw as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
);
async function keyFromPassword(password: string, salt: Uint8Array, iterations = KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}
async function encrypt(key: CryptoKey, bytes: Uint8Array): Promise<EncryptedPart> {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource }, key, bytes as BufferSource
  ));
  return { iv: encode64(iv), data: encode64(ciphertext) };
}
async function decrypt(key: CryptoKey, part: EncryptedPart): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode64(part.iv) as BufferSource },
    key, decode64(part.data) as BufferSource
  ));
}

export function parseVaultFile(source: string): RasdVaultFile {
  if (source.length > MAX_ENVELOPE_LENGTH) throw new Error("النسخة الاحتياطية أكبر من الحد المسموح.");
  let data: any;
  try { data = JSON.parse(source); } catch { throw new Error("ملف النسخة الاحتياطية غير صالح."); }
  const part = (p: any) => p && typeof p.iv === "string" && typeof p.data === "string" &&
    p.iv.length > 0 && p.data.length > 0 && p.iv.length < 120;
  if (!data || data.format !== "rasd-android-local-v1" || data.version !== 1 ||
      typeof data.createdAt !== "string" || !data.password ||
      data.password.iterations !== KDF_ITERATIONS ||
      typeof data.password.salt !== "string" ||
      !part(data.password.wrappedKey) || !part(data.recovery) || !part(data.vault))
    throw new Error("صيغة نسخة رصد غير مدعومة أو غير مكتملة.");
  return data as RasdVaultFile;
}
async function decryptLedger(file: RasdVaultFile, keyBytes: Uint8Array): Promise<OpenedVault> {
  if (keyBytes.length !== 32) throw new Error("مفتاح الخزنة غير صالح.");
  try {
    const plain = await decrypt(await importAes(keyBytes), file.vault);
    return { keyBytes, ledger: validateLedger(JSON.parse(decoder.decode(plain))) };
  } catch {
    throw new Error("تعذر فك تشفير بيانات رصد أو التحقق من سلامتها.");
  }
}
export async function createVault(password: string): Promise<CreatedVault> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error("كلمة المرور الرئيسية يجب أن تحتوي 12 حرفًا على الأقل.");
  const keyBytes = randomBytes(32), salt = randomBytes(16), recoverySecret = randomBytes(32);
  const passwordKey = await keyFromPassword(password, salt);
  const passwordWrapped = await encrypt(passwordKey, keyBytes);
  const recoveryWrapped = await encrypt(await importAes(recoverySecret), keyBytes);
  const ledger = emptyLedger();
  const encrypted = await encrypt(await importAes(keyBytes), encoder.encode(JSON.stringify(ledger)));
  return {
    keyBytes, ledger,
    recoveryCode: "RSD-" + encode64(recoverySecret),
    file: {
      format: "rasd-android-local-v1", version: 1, createdAt: new Date().toISOString(),
      password: { salt: encode64(salt), iterations: KDF_ITERATIONS, wrappedKey: passwordWrapped },
      recovery: recoveryWrapped, vault: encrypted,
    },
  };
}
/**
 * Only call after Android Keystore's authenticated CryptoObject returned this
 * DEK. The vault's AES-GCM authentication tag verifies the exact key.
 * Clone so callers may erase their bridge result without locking the UI.
 */
export async function unlockWithDeviceKey(
  file: RasdVaultFile, rawKey: Uint8Array,
): Promise<OpenedVault> {
  if (rawKey.length !== 32) throw new Error("مفتاح الجهاز غير صالح.");
  return decryptLedger(file, new Uint8Array(rawKey));
}

export async function unlockWithPassword(file: RasdVaultFile, password: string): Promise<OpenedVault> {
  try {
    const key = await keyFromPassword(password, decode64(file.password.salt), file.password.iterations);
    return decryptLedger(file, await decrypt(key, file.password.wrappedKey));
  } catch { throw new Error("كلمة المرور غير صحيحة أو بيانات الخزنة تالفة."); }
}
export async function unlockWithRecoveryCode(file: RasdVaultFile, code: string): Promise<OpenedVault> {
  try {
    if (!code.startsWith("RSD-")) throw Error("invalid prefix");
    const raw = decode64(code.slice(4));
    if (raw.length !== 32) throw Error("invalid length");
    return decryptLedger(file, await decrypt(await importAes(raw), file.recovery));
  } catch { throw new Error("رمز الاسترداد غير صحيح أو النسخة تالفة."); }
}
export async function sealVault(file: RasdVaultFile, keyBytes: Uint8Array, ledger: LocalLedger): Promise<RasdVaultFile> {
  validateLedger(ledger);
  return { ...file, vault: await encrypt(await importAes(keyBytes), encoder.encode(JSON.stringify(ledger))) };
}
export async function setNewPassword(file: RasdVaultFile, keyBytes: Uint8Array, password: string): Promise<RasdVaultFile> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error("كلمة المرور الجديدة يجب أن تحتوي 12 حرفًا على الأقل.");
  const salt = randomBytes(16), kdf = await keyFromPassword(password, salt);
  return { ...file, password: {
    salt: encode64(salt), iterations: KDF_ITERATIONS, wrappedKey: await encrypt(kdf, keyBytes),
  } };
}
