import { registerPlugin, Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { type RasdVaultFile } from "./crypto";
import {
  commitVaultFiles, inspectVaultFiles, promoteVaultCandidate,
  type VaultFileName, type VaultFiles, type VaultInspection,
} from "./vault-transaction";

/**
 * App-private Android Data directory. No localStorage, cookies, Supabase or
 * remotely hosted website is used for persistent financial records.
 */
interface AtomicVaultPlugin {
  read(options: { name: VaultFileName }): Promise<{ exists: boolean; data?: string }>;
  write(options: { name: VaultFileName; data: string }): Promise<void>;
  remove(options: { name: VaultFileName }): Promise<void>;
}
const nativeVault = registerPlugin<AtomicVaultPlugin>("RasdAtomicVault");
function requireAndroid() {
  if (Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("RasdAtomicVault")) {
    throw new Error("التخزين الآمن متاح فقط في نسخة رصد Android المحلية.");
  }
}
const adapter: VaultFiles = {
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

/** Save the already encrypted envelope into Android cache and let the owner
 * choose Google Drive / local file manager in Android's official share sheet.
 * No background upload, Google sign-in, or plaintext export takes place.
 */
export async function shareEncryptedBackup(file: RasdVaultFile): Promise<void> {
  const name = "rasd-backup-" + new Date().toISOString().slice(0,10) + ".rasd";
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
