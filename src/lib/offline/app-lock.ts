import { Capacitor, registerPlugin } from "@capacitor/core";
import { unlockWithPassword, type RasdVaultFile } from "./crypto";
import { getDeviceVaultTag } from "./device-unlock";

export type AppLockMethod = "pin" | "pattern";
export type AppLockProbe = { enabled: boolean; blocked: boolean };
interface AppLockBridge {
  probe(options: { method: AppLockMethod; vaultTag: string }): Promise<AppLockProbe>;
  enable(options: { method: AppLockMethod; vaultTag: string; secret: string; keyBase64: string }): Promise<void>;
  unlock(options: { method: AppLockMethod; vaultTag: string; secret: string }): Promise<{ keyBase64: string }>;
  disable(options: { method: AppLockMethod }): Promise<void>;
}
const bridge = registerPlugin<AppLockBridge>("RasdAppLock");

export function supportsAppLockPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    && Capacitor.isPluginAvailable("RasdAppLock");
}
function requireBridge() {
  if (!supportsAppLockPlatform()) throw new Error("الرمز والنمط المستقلان متاحان في Android المدعوم فقط.");
}

/** Android-style grid: automatically visit an unvisited midpoint before the
 * new node. A node can be used only once. Values are row-major 1 through 9. */
export function appendPatternNode(pattern: string, node: number): string {
  if (!Number.isInteger(node) || node < 1 || node > 9 || !/^[1-9]*$/.test(pattern)
      || new Set(pattern).size !== pattern.length) throw new Error("نقطة نمط غير صالحة.");
  const next = String(node);
  if (pattern.includes(next)) return pattern;
  const previous = Number(pattern.slice(-1));
  if (previous) {
    const r1 = Math.floor((previous - 1) / 3), c1 = (previous - 1) % 3;
    const r2 = Math.floor((node - 1) / 3), c2 = (node - 1) % 3;
    if ((r1 + r2) % 2 === 0 && (c1 + c2) % 2 === 0) {
      const middle = String(((r1 + r2) / 2) * 3 + (c1 + c2) / 2 + 1);
      if (middle !== String(previous) && middle !== next && !pattern.includes(middle)) pattern += middle;
    }
  }
  return pattern + next;
}
export function validAppCredential(method: AppLockMethod, secret: string): boolean {
  if (method === "pin") {
    return /^[0-9]{6,12}$/.test(secret) && !/^([0-9])\1+$/.test(secret)
      && !"012345678901234567890123".includes(secret)
      && !"987654321098765432109876".includes(secret);
  }
  if (method !== "pattern" || !/^[1-9]{6,9}$/.test(secret)) return false;
  let canonical = "";
  for (const n of secret) canonical = appendPatternNode(canonical, Number(n));
  return canonical === secret;
}
export async function probeAppLock(file: RasdVaultFile, method: AppLockMethod): Promise<AppLockProbe> {
  if (!supportsAppLockPlatform()) return { enabled: false, blocked: false };
  const status = await bridge.probe({ method, vaultTag: await getDeviceVaultTag(file) });
  return { enabled: status.enabled === true, blocked: status.blocked === true };
}
function encodeKey(raw: Uint8Array): string {
  if (raw.length !== 32) throw new Error("مفتاح الخزنة غير صالح.");
  return btoa(String.fromCharCode(...raw));
}
function decodeKey(text: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(text)) throw new Error("مفتاح الفتح غير صالح.");
  const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
  if (bytes.length !== 32 || encodeKey(bytes) !== text) throw new Error("مفتاح الفتح غير صالح.");
  return bytes;
}

/** Never take the existing unlocked session's key as authority for settings.
 * Reauthenticate using the current vault's actual master password, then verify
 * that the UI is still open and the same snapshot is current before bridging. */
export async function enrollAppLock(file: RasdVaultFile, method: AppLockMethod, secret: string,
  confirmation: string, masterPassword: string, stillAuthorized: () => boolean): Promise<void> {
  requireBridge();
  if (!validAppCredential(method, secret) || secret !== confirmation)
    throw new Error("اختر رمزًا أو نمطًا صالحًا ومتطابقًا مع التأكيد.");
  const opened = await unlockWithPassword(file, masterPassword);
  try {
    const vaultTag = await getDeviceVaultTag(file);
    if (!stillAuthorized()) throw new Error("انتهت جلسة الإعداد؛ افتح الخزنة مجددًا.");
    await bridge.enable({ method, vaultTag, secret, keyBase64: encodeKey(opened.keyBytes) });
    // Enrollment may complete after the app has been locked in the background.
    // Revoke the newly created shortcut rather than keeping a stale grant.
    if (!stillAuthorized()) {
      await bridge.disable({ method });
      throw new Error("انتهت جلسة الإعداد؛ أُلغي الاختصار الجديد.");
    }
  } finally { opened.keyBytes.fill(0); }
}
export async function removeAppLock(file: RasdVaultFile, method: AppLockMethod,
  masterPassword: string, stillAuthorized: () => boolean): Promise<void> {
  requireBridge();
  const opened = await unlockWithPassword(file, masterPassword);
  try {
    if (!stillAuthorized()) throw new Error("انتهت جلسة الإعداد؛ افتح الخزنة مجددًا.");
    await bridge.disable({ method });
  } finally { opened.keyBytes.fill(0); }
}
export async function unlockAppLock(file: RasdVaultFile, method: AppLockMethod, secret: string): Promise<Uint8Array> {
  requireBridge();
  // Native layer counts every attempted credential, including malformed ones.
  return decodeKey((await bridge.unlock({ method, vaultTag: await getDeviceVaultTag(file), secret })).keyBase64);
}

/** Call before replacing the vault or resetting credentials, and propagate
 * any failure instead of leaving stale authorization silently enabled. */
export async function invalidateAppLocks(): Promise<void> {
  requireBridge();
  await bridge.disable({ method: "pin" });
  await bridge.disable({ method: "pattern" });
}
