import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { parseVaultFile, type RasdVaultFile } from "./crypto";
import {
  commitVaultFiles, inspectVaultFiles, promoteVaultCandidate,
  type VaultFileName, type VaultFiles, type VaultInspection,
} from "./vault-transaction";

/**
 * App-private Android Data directory. No localStorage, cookies, Supabase or
 * remotely hosted website is used for persistent financial records.
 */
const PRIMARY = "rasd-private-v1.json";
const PREVIOUS = "rasd-private-previous-v1.json";
const DRAFT = "rasd-private-pending-v1.json";

async function readFile(path: string): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
    if (typeof result.data !== "string") throw new Error("Unexpected binary app storage");
    return result.data;
  } catch (error) {
    const message = String(error).toLowerCase();
    if (/does not exist|file does not exist|not found|os-plug-file-0008|enoent/.test(message))
      return null;
    throw error;
  }
}
const NAMES: Record<VaultFileName, string> = {
  primary: PRIMARY, previous: PREVIOUS, pending: DRAFT,
};
const adapter: VaultFiles = {
  read: name => readFile(NAMES[name]),
  write: async (name, data) => {
    await Filesystem.writeFile({
      path: NAMES[name], directory: Directory.Data, data, encoding: Encoding.UTF8,
    });
  },
  remove: async name => {
    await Filesystem.deleteFile({ path: NAMES[name], directory: Directory.Data });
  },
};

export async function inspectDeviceVault(): Promise<VaultInspection> {
  return inspectVaultFiles(adapter);
}

export async function loadDeviceVault(): Promise<RasdVaultFile | null> {
  const result = await inspectDeviceVault();
  if (result.kind === "empty") return null;
  if (result.kind === "ready") return result.file;
  throw new Error("توجد عملية حفظ غير مكتملة أو ملف غير سليم. راجع الاسترداد قبل إنشاء خزنة جديدة.");
}

export async function saveDeviceVault(file: RasdVaultFile): Promise<void> {
  return commitVaultFiles(adapter, file);
}

/** Authenticated and explicitly confirmed restore of selected local snapshot. */
export async function recoverDeviceVault(
  source: VaultFileName, decryptedCandidate: RasdVaultFile,
): Promise<void> {
  return promoteVaultCandidate(adapter, source, decryptedCandidate);
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
