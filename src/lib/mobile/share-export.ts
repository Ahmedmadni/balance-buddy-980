import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type ExportOutcome = "share_sheet_opened" | "browser_download_requested";

export function safeExportName(name: string): string {
  const cleaned = name.replace(/[\\/<>:"|?*\x00-\x1f]/g, "-").replace(/^\.+/, "").trim().slice(0, 120);
  if (!cleaned || cleaned === "." || cleaned === "..") throw new Error("اسم ملف غير صالح");
  return cleaned;
}

function toBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let encoded = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    encoded += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(encoded);
}

/**
 * Android never silently "downloads" Blob URLs. Write to the app cache, then
 * open Android's system share sheet (Files, Drive, etc.). The user must choose
 * a destination; returning here does not prove a permanent copy was saved.
 */
export async function exportFile(blob: Blob, filename: string): Promise<ExportOutcome> {
  const name = safeExportName(filename);
  if (Capacitor.isNativePlatform()) {
    const data = toBase64(new Uint8Array(await blob.arrayBuffer()));
    const tempName = `rasd-${crypto.randomUUID()}-${name}`;
    const written = await Filesystem.writeFile({
      path: tempName,
      directory: Directory.Cache,
      data,
    });
    await Share.share({
      title: "تصدير ملف رصد",
      url: written.uri,
      dialogTitle: "اختر تطبيق الملفات أو Google Drive لحفظ النسخة",
    });
    // Do not delete the cache immediately: the receiving Android activity may
    // still be reading the URI. Cache entries are temporary, not a backup.
    return "share_sheet_opened";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return "browser_download_requested";
}
