export type BackupV2 = {
  format: "rasd-backup";
  version: 2;
  exported_at?: string;
  data: Record<string, unknown>;
};

export function validateBackupV2(raw: unknown): BackupV2 | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.format !== "rasd-backup" || value.version !== 2) return null;
  if (typeof value.data !== "object" || value.data === null || Array.isArray(value.data)) return null;
  if (value.exported_at !== undefined &&
    (typeof value.exported_at !== "string" || !Number.isFinite(Date.parse(value.exported_at)))) return null;
  return raw as BackupV2;
}

export function isBackupJsonFile(name: string): boolean {
  return /\.json$/i.test(name);
}