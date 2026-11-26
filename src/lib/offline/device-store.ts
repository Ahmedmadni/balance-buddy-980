import { registerPlugin, Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { parseVaultFile, unlockWithPassword, type RasdVaultFile } from "./crypto";
import { restoreVerifiedBackup, type RestoreRequest } from "./backup-restore";
import {
  commitVaultFiles, inspectVaultFiles, promoteVaultCandidate,
  type VaultFileName, type VaultFiles, type VaultInspection,
} from "./vault-transaction";

/**
 * App-private Android Data directory. No localStorage, cookies, Supabase or
 * remotely hosted website is used for persistent financial records.
 */
type NativeSlot = VaultFileName | "restore-safety";
interface AtomicVaultPlugin {
  read(options: { name: NativeSlot }): Promise<{ exists: boolean; data?: string }>;
  write(options: { name: NativeSlot; data: string }): Promise<void>;
  remove(options: { name: NativeSlot }): Promise<void>;
}
const nativeVault = registerPlugin<AtomicVaultPlugin>("RasdAtomicVault");
function requireAndroid() {
  if (Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("RasdAtomicVault")) {
    throw new Error("التخزين الآمن متاح فقط في نسخة رصد Android المحلية.");
  }
}
const adapter: VaultFiles & { read(name: NativeSlot): Promise<string | null>; write(name: NativeSlot, data: string): Promise<void>; remove(name: NativeSlot): Promise<void> } = {
  read: async name => {
    requireAndroid();
    const result = await nativeVault.read({ name });
    if (result.exists === false) return null;
    if (result.exists !== true || typeof result.data !== "string")
      throw new Error("تعذرت قراءة الخزنة المحلية.");
    return result.data;
  },
  write: async (name, data) => {
    requireAndroid();
    await nativeVault.write({ name, data });
  },
  remove: async name => {
    requireAndroid();
    await nativeVault.remove({ name });
  },
};

// Serialize complete multi-slot transactions, not merely individual calls.
let tail: Promise<void> = Promise.resolve();
function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation);
  tail = result.then(() => undefined, () => undefined);
  return result;
}

export async function inspectDeviceVault(): Promise<VaultInspection> {
  return exclusive(() => inspectVaultFiles(adapter));
}

export async function loadDeviceVault(): Promise<RasdVaultFile | null> {
  const result = await inspectDeviceVault();
  if (result.kind === "empty") return null;
  if (result.kind === "ready") return result.file;
  throw new Error("توجد عملية حفظ غير مكتملة أو ملف غير سليم. راجع الاسترداد قبل إنشاء خزنة جديدة.");
}

export async function saveDeviceVault(file: RasdVaultFile): Promise<void> {
  return exclusive(() => commitVaultFiles(adapter, file));
}

/** Authenticated and explicitly confirmed restore of selected local snapshot. */
export async function recoverDeviceVault(
  source: VaultFileName, decryptedCandidate: RasdVaultFile,
): Promise<void> {
  return exclusive(() => promoteVaultCandidate(adapter, source, decryptedCandidate));
}

const safety = {
  read: () => adapter.read("restore-safety"),
  write: (encrypted: string) => adapter.write("restore-safety", encrypted),
};

export function restoreDeviceBackup(request: RestoreRequest) {
  return exclusive(() => restoreVerifiedBackup(adapter,safety,request));
}

export function hasRestoreSafetyCopy(): Promise<boolean> {
  return exclusive(async () => (await safety.read()) !== null);
}

/** Authenticate current owner before accessing or retiring the old encrypted
 * copy. Sharing does not certify that a destination actually saved the file. */
async function authorizedSafetyCopy(expected: RasdVaultFile, master: string, authorized: () => boolean) {
  const current = await inspectVaultFiles(adapter);
  if (!authorized() || current.kind !== "ready" || JSON.stringify(current.file) !== JSON.stringify(expected))
    throw new Error("تغيّرت الخزنة أو انتهت الجلسة.");
  const value = await unlockWithPassword(current.file,master);
  value.keyBytes.fill(0);
  if (!authorized()) throw new Error("انتهت الجلسة.");
  const raw = await safety.read();
  if (raw === null) throw new Error("لا توجد نسخة أمان سابقة.");
  if (!authorized()) throw new Error("انتهت الجلسة.");
  return raw;
}

export function exportRestoreSafetyCopy(expected: RasdVaultFile, master: string, authorized: () => boolean) {
  return exclusive(async () => {
    const raw = await authorizedSafetyCopy(expected,master,authorized);
    await shareEncryptedBackup(parseVaultFile(raw),"rasd-before-restore");
  });
}

export function retireRestoreSafetyCopy(expected: RasdVaultFile, master: string, confirmation: string, authorized: () => boolean) {
  return exclusive(async () => {
    if (confirmation.trim() !== "حفظت النسخة") throw new Error("أكد حفظ نسخة الأمان خارج التطبيق أولًا.");
    await authorizedSafetyCopy(expected,master,authorized);
    if (!authorized()) throw new Error("انتهت الجلسة.");
    await adapter.remove("restore-safety");
    if (await safety.read() !== null) throw new Error("تعذّر تحرير نسخة الأمان.");
  });
}

/** Save the already encrypted envelope into Android cache and let the owner
 * choose Google Drive / local file manager in Android's official share sheet.
 * No background upload, Google sign-in, or plaintext export takes place.
 */
export async function shareEncryptedBackup(file: RasdVaultFile, prefix: "rasd-backup" | "rasd-before-restore" = "rasd-backup"): Promise<void> {
  const name = prefix + "-" + new Date().toISOString().slice(0,10) + "-" + crypto.randomUUID() + ".rasd";
  await Filesystem.writeFile({ path: name, directory: Directory.Cache,
    data: JSON.stringify(file), encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
  await Share.share({
    title: "نسخة رصد المشفرة",
    text: "احتفظ بكلمة المرور ورمز الاسترداد في مكان منفصل عن النسخة.",
    files: [uri],
    dialogTitle: "حفظ في الجهاز أو Google Drive",
  });
}
