export const BACKUP_V2_COLLECTIONS = [
  "wallets",
  "contacts",
  "categories",
  "projects",
  "wallet_tx_categories",
  "investments",
  "investment_transactions",
  "asset_market_values",
  "depreciation_profiles",
  "expenses",
  "expense_allocations",
  "recurring_expenses",
  "person_ledger",
  "wallet_transactions",
  "debts",
  "debt_payments",
  "exchange_rates",
  "zakat_settings",
  "zakat_records",
] as const;

const PROHIBITED_COLLECTIONS = ["transactions", "attachments", "system_events"] as const;

export type BackupV2 = {
  format: "rasd-backup";
  version: 2;
  exported_at?: string;
  profile?: Record<string, unknown>;
  data: Record<(typeof BACKUP_V2_COLLECTIONS)[number], Record<string, unknown>[]>;
};

/**
 * Match the destructive restore_user_backup RPC preflight checks.
 * A missing table must NEVER be treated as an empty table. Enforce before
 * showing the confirmation dialog; the SQL RPC validates again atomically.
 */
export function validateBackupV2(raw: unknown): BackupV2 | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.format !== "rasd-backup" || value.version !== 2) return null;
  if (typeof value.data !== "object" || value.data === null || Array.isArray(value.data)) return null;
  if (value.exported_at !== undefined &&
    (typeof value.exported_at !== "string" || !Number.isFinite(Date.parse(value.exported_at)))) return null;

  if (value.profile !== undefined) {
    if (typeof value.profile !== "object" || value.profile === null || Array.isArray(value.profile)) return null;
    if ("id" in value.profile || "user_id" in value.profile) return null;
  }
  const data = value.data as Record<string, unknown>;
  if (PROHIBITED_COLLECTIONS.some((key) => key in data)) return null;
  for (const name of BACKUP_V2_COLLECTIONS) {
    const rows = data[name];
    if (!Array.isArray(rows)) return null;
    for (const row of rows) {
      if (typeof row !== "object" || row === null || Array.isArray(row) || "user_id" in row) return null;
    }
  }
  return raw as BackupV2;
}

export function countBackupV2Rows(backup: BackupV2): number {
  return BACKUP_V2_COLLECTIONS.reduce((sum, key) => sum + backup.data[key].length, 0);
}

export function isBackupJsonFile(name: string): boolean {
  return /\.json$/i.test(name);
}
