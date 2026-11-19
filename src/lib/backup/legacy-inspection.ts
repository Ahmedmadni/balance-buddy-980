/**
 * Read-only inspection for historical plaintext backup v1 documents.
 * This module MUST NOT return the original rows or write to Supabase.
 * Old v1 files cannot safely be restored by non-atomic table upserts.
 */
export interface LegacyInspection {
  scope: "full" | "financial" | "assets" | "reports";
  exportedAt: string;
  tables: number;
  records: number;
  warnings: string[];
}

const SCOPES = new Set(["full", "financial", "assets", "reports"]);
const V1_TABLES = new Set([
  "profiles", "categories", "wallet_tx_categories", "contacts", "projects",
  "wallets", "wallet_transactions", "expenses", "recurring_expenses",
  "person_ledger", "investments", "investment_transactions",
  "asset_market_values", "depreciation_profiles",
  "zakat_settings", "zakat_records", "system_events",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function inspectLegacyBackup(raw: unknown): LegacyInspection | null {
  if (!record(raw) || !record(raw.meta) || !record(raw.data)) return null;
  const { meta, data } = raw;
  if (meta.app !== "rasd" || meta.version !== 1 ||
      typeof meta.scope !== "string" || !SCOPES.has(meta.scope) ||
      typeof meta.exported_at !== "string" ||
      !Number.isFinite(Date.parse(meta.exported_at))) return null;

  const names = Object.keys(data);
  if (names.length === 0 || names.some((name) => !V1_TABLES.has(name))) return null;
  let records = 0;
  const warnings: string[] = [];
  const counts = record(meta.counts) ? meta.counts : {};
  for (const name of names) {
    const rows = data[name];
    if (!Array.isArray(rows) || rows.some((r) => !record(r))) return null;
    records += rows.length;
    if (counts[name] !== rows.length) {
      warnings.push(`عدد سجلات ${name} يختلف عن البيان المحفوظ في الملف`);
    }
  }
  for (const name of Object.keys(counts)) {
    if (!names.includes(name)) warnings.push(`الجدول ${name} مذكور في البيان لكنه مفقود من الملف`);
  }
  return {
    scope: meta.scope as LegacyInspection["scope"],
    exportedAt: meta.exported_at,
    tables: names.length,
    records,
    warnings,
  };
}
