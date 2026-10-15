// A backup must have every v2 collection before it is treated as restorable.
// Keep this in sync with supabase/migrations/20260903000000_backup_restore_v2_schema_parity.sql.
export const RASD_V2_COLLECTIONS = [
  "wallets", "contacts", "categories", "projects", "wallet_tx_categories",
  "investments", "investment_transactions", "asset_market_values",
  "depreciation_profiles", "expenses", "expense_allocations",
  "recurring_expenses", "person_ledger", "wallet_transactions", "debts",
  "debt_payments", "exchange_rates", "zakat_settings", "zakat_records",
] as const;

export interface RasdBackupV2 {
  format: "rasd-backup";
  version: 2;
  exported_at?: string;
  data: Record<string, unknown[]>;
}

export function isRasdBackupV2(value: unknown): value is RasdBackupV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.format !== "rasd-backup" || v.version !== 2) return false;
  if (!v.data || typeof v.data !== "object" || Array.isArray(v.data)) return false;
  const data = v.data as Record<string, unknown>;
  if ("transactions" in data || "attachments" in data || "system_events" in data) return false;
  return RASD_V2_COLLECTIONS.every(k => {
    const rows = data[k];
    return Array.isArray(rows) && rows.every(row =>
      row !== null && typeof row === "object" && !Array.isArray(row) &&
      !Object.prototype.hasOwnProperty.call(row, "user_id")
    );
  });
}
