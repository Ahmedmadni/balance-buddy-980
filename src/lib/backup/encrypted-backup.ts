/**
 * Password-encrypted, portable financial backup. No password or plaintext is
 * stored persistently, and encryption is independent of the UI app lock.
 */
export interface EncryptedBackup {
  format: "rasd-encrypted-backup";
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: 310000;
  cipher: "AES-256-GCM";
  salt: string;
  iv: string;
  data: string;
}

const iterations = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error("Invalid encoding");
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export function isEncryptedBackup(raw: unknown): raw is EncryptedBackup {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const v = raw as Record<string, unknown>;
  return v.format === "rasd-encrypted-backup" && v.version === 1 &&
    v.cipher === "AES-256-GCM" && v.kdf === "PBKDF2-SHA256" && v.iterations === iterations &&
    typeof v.iv === "string" && typeof v.salt === "string" && typeof v.data === "string";
}

export async function encryptBackup(value: unknown, password: string): Promise<EncryptedBackup> {
  if (password.length < 12) throw new Error("كلمة مرور النسخة الاحتياطية يجب ألا تقل عن 12 حرفا");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, "encrypt");
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return {
    format: "rasd-encrypted-backup", version: 1, kdf: "PBKDF2-SHA256",
    iterations, cipher: "AES-256-GCM", salt: encode(salt), iv: encode(iv), data: encode(ciphertext),
  };
}

export async function decryptBackup(envelope: EncryptedBackup, password: string): Promise<unknown> {
  if (!isEncryptedBackup(envelope)) throw new Error("صيغة نسخة احتياطية غير مدعومة");
  try {
    const salt = decode(envelope.salt);
    const iv = decode(envelope.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("Invalid IV/salt");
    const key = await deriveKey(password, salt, "decrypt");
    const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, decode(envelope.data));
    return JSON.parse(decoder.decode(bytes));
  } catch {
    // Avoid revealing whether a password, authentication tag, or file failed.
    throw new Error("كلمة المرور غير صحيحة أو ملف النسخة تالف");
  }
}
