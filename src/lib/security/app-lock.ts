// App lock: PIN (PBKDF2 hash) + optional device biometrics. Stored only on this device (localStorage).
const KEY = "rasd.app-lock.v1";

export interface AppLockConfig {
  enabled: boolean;
  salt: string; // hex
  hash: string; // hex
  biometric: boolean;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

const toHex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: 150_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export function loadLock(): AppLockConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as AppLockConfig;
    return c?.enabled && c.hash && c.salt ? c : null;
  } catch {
    return null;
  }
}

export async function setPin(pin: string, biometric: boolean): Promise<void> {
  if (!isValidPin(pin)) throw new Error("الرمز يجب أن يكون من 4 إلى 8 أرقام");
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPin(pin, salt);
  localStorage.setItem(KEY, JSON.stringify({ enabled: true, salt, hash, biometric }));
}

export function setBiometric(on: boolean) {
  const c = loadLock();
  if (c) localStorage.setItem(KEY, JSON.stringify({ ...c, biometric: on }));
}

export function disableLock() {
  localStorage.removeItem(KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const c = loadLock();
  if (!c) return true;
  return (await hashPin(pin, c.salt)) === c.hash;
}

// ---- Biometrics (Android native only) ----
async function plugin() {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  const m = await import("@aparajita/capacitor-biometric-auth");
  return m.BiometricAuth;
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    const p = await plugin();
    if (!p) return false;
    const r = await p.checkBiometry();
    return !!(r.isAvailable || r.deviceIsSecure);
  } catch {
    return false;
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  try {
    const p = await plugin();
    if (!p) return false;
    await p.authenticate({
      reason: "افتح رصد",
      cancelTitle: "استخدم الرمز",
      androidTitle: "فتح رصد",
      androidSubtitle: "استخدم البصمة أو الوجه",
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}
