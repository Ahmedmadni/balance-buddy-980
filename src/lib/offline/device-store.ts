import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { parseVaultFile, type RasdVaultFile } from "./crypto";

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
export async function loadDeviceVault(): Promise<RasdVaultFile | null> {
  const text = await readFile(PRIMARY);
  if (text === null) return null;
  // Deliberately do NOT silently load the previous version on damage, which
  // could roll back financial transactions without the user's consent.
  return parseVaultFile(text);
}
export async function saveDeviceVault(file: RasdVaultFile): Promise<void> {
  const serialized = JSON.stringify(parseVaultFile(JSON.stringify(file)));
  // Verify the pending write before touching the committed vault.
  await Filesystem.writeFile({ path: DRAFT, directory: Directory.Data,
    data: serialized, encoding: Encoding.UTF8 });
  if (await readFile(DRAFT) !== serialized) throw new Error("تعذر التحقق من حفظ البيانات على الجهاز.");
  const old = await readFile(PRIMARY);
  if (old !== null) await Filesystem.writeFile({ path: PREVIOUS, directory: Directory.Data,
    data: old, encoding: Encoding.UTF8 });
  await Filesystem.writeFile({ path: PRIMARY, directory: Directory.Data,
    data: serialized, encoding: Encoding.UTF8 });
  if (await readFile(PRIMARY) !== serialized) throw new Error("لم يكتمل حفظ الخزنة. لا تغلق التطبيق قبل معالجة الخطأ.");
  await Filesystem.deleteFile({ path: DRAFT, directory: Directory.Data }).catch(() => {});
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
