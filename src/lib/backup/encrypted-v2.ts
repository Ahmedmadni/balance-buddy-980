// Password-protected, portable local backup format.
// No account credentials, recovery key or plaintext is uploaded by this module.
export const RASD_KDF_ITERATIONS = 310_000;
export const RASD_ENCRYPTED_FORMAT = "rasd-backup-encrypted";

export interface EncryptedRasdBackup {
  format: typeof RASD_ENCRYPTED_FORMAT;
  version: 1;
  kdf: { algorithm: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { algorithm: "AES-GCM"; iv: string };
  payload: string;
}

function encode64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  }
  return btoa(binary);
}
function decode64(input: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 !== 0) {
    throw new Error("النسخة المشفرة تالفة");
  }
  return Uint8Array.from(atob(input), c => c.charCodeAt(0));
}
function getCrypto(): Crypto {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("يتطلب تشفير النسخة اتصال HTTPS أو بيئة آمنة");
  }
  return crypto;
}
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const webCrypto = getCrypto();
  const secret = await webCrypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"],
  );
  return webCrypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: RASD_KDF_ITERATIONS, hash: "SHA-256" },
    secret, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}
export function isEncryptedRasdBackup(value: unknown): value is EncryptedRasdBackup {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as Partial<EncryptedRasdBackup>;
  return x.format === RASD_ENCRYPTED_FORMAT && x.version === 1
    && x.kdf?.algorithm === "PBKDF2" && x.kdf?.hash === "SHA-256"
    && x.kdf?.iterations === RASD_KDF_ITERATIONS
    && x.cipher?.algorithm === "AES-GCM"
    && typeof x.kdf?.salt === "string" && typeof x.cipher?.iv === "string"
    && typeof x.payload === "string";
}
export async function encryptRasdBackup(data: unknown, password: string): Promise<EncryptedRasdBackup> {
  if (password.length < 12) throw new Error("كلمة مرور النسخة يجب ألا تقل عن 12 حرفاً");
  const webCrypto = getCrypto();
  const salt = webCrypto.getRandomValues(new Uint8Array(16));
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await webCrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    format: RASD_ENCRYPTED_FORMAT,
    version: 1,
    kdf: { algorithm: "PBKDF2", hash: "SHA-256", iterations: RASD_KDF_ITERATIONS, salt: encode64(salt) },
    cipher: { algorithm: "AES-GCM", iv: encode64(iv) },
    payload: encode64(new Uint8Array(ciphertext)),
  };
}
export async function decryptRasdBackup(envelope: unknown, password: string): Promise<unknown> {
  if (!isEncryptedRasdBackup(envelope)) throw new Error("صيغة النسخة المشفرة غير مدعومة");
  const salt = decode64(envelope.kdf.salt);
  const iv = decode64(envelope.cipher.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("رأس النسخة المشفرة غير صالح");
  const key = await deriveKey(password, salt);
  try {
    const plaintext = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv }, key, decode64(envelope.payload),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("كلمة المرور غير صحيحة أو محتوى النسخة تالف");
  }
}
