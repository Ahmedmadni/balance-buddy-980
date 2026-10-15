// Zero-knowledge encrypted backup objects in a private Supabase Storage bucket.
// Passwords are used by the calling UI in memory only and NEVER sent to Storage.
import { supabase } from "@/integrations/supabase/client";
import { isEncryptedRasdBackup, type EncryptedRasdBackup } from "./encrypted-v2";

export const RASD_CLOUD_BUCKET = "rasd-private-backups";
export const MAX_CLOUD_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = MAX_CLOUD_BACKUP_BYTES;

export interface CloudBackupInfo {
  name: string;
  createdAt: string;
  bytes: number | null;
}

export function isValidBackupObjectName(name: string): boolean {
  return /^rasd-[0-9]{8}T[0-9]{6}-[0-9a-f-]{36}\.json$/.test(name) && !name.includes("/");
}

export function backupObjectPath(userId: string, name: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !isValidBackupObjectName(name)) {
    throw new Error("اسم ملف النسخة السحابية غير صالح");
  }
  return `${userId}/${name}`;
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("يلزم تسجيل الدخول لحفظ النسخ السحابية");
  return data.user.id;
}

export async function listCloudBackups(): Promise<CloudBackupInfo[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.storage.from(RASD_CLOUD_BUCKET).list(uid, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  return (data ?? [])
    .filter(item => isValidBackupObjectName(item.name))
    .map(item => ({
      name: item.name,
      createdAt: item.created_at ?? "",
      bytes: typeof item.metadata?.size === "number" ? item.metadata.size : null,
    }));
}

export async function uploadEncryptedCloudBackup(envelope: EncryptedRasdBackup): Promise<string> {
  if (!isEncryptedRasdBackup(envelope)) throw new Error("لا يمكن رفع نسخة غير مشفرة");
  const uid = await getCurrentUserId();
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
  // YYYYMMDDTHHMMSS
  const name = `rasd-${now}-${crypto.randomUUID()}.json`;
  const body = new Blob([JSON.stringify(envelope)], { type: "application/json" });
  if (body.size > MAX_CLOUD_BACKUP_BYTES) throw new Error("النسخة تتجاوز حد التخزين السحابي (25 MB)");
  const { error } = await supabase.storage.from(RASD_CLOUD_BUCKET).upload(backupObjectPath(uid, name), body, {
    contentType: "application/json",
    upsert: false,
    cacheControl: "0",
  });
  if (error) throw error;
  return name;
}

export async function downloadEncryptedCloudBackup(name: string): Promise<EncryptedRasdBackup> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.storage.from(RASD_CLOUD_BUCKET).download(backupObjectPath(uid, name));
  if (error) throw error;
  if (!data || data.size > MAX_DOWNLOAD_BYTES) throw new Error("حجم ملف النسخة يتجاوز الحد المسموح");
  let parsed: unknown;
  try { parsed = JSON.parse(await data.text()); }
  catch { throw new Error("تعذر قراءة ملف النسخة السحابية"); }
  if (!isEncryptedRasdBackup(parsed)) throw new Error("محتوى النسخة السحابية غير مشفر أو غير مدعوم");
  return parsed;
}

export async function deleteCloudBackup(name: string): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase.storage.from(RASD_CLOUD_BUCKET).remove([backupObjectPath(uid, name)]);
  if (error) throw error;
}
