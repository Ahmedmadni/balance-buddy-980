// Backup / Restore / Import / Export Engine
// Read-only against DB schema — does NOT modify triggers, views, or the
// `transactions` derived table. On import, `transactions` and
// `investment_transactions` are intentionally excluded from write paths
// because they are populated/managed by database triggers.
//
// Local-only: no cloud sync, no scheduled jobs, no encryption, no compression.
// Cloud provider hooks (Google Drive / iCloud / OneDrive / Dropbox) are
// declared as stubs for future integration but not implemented.

import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { readAllBackupRows } from "./paged-export";
import { validateLegacyBackup } from "./legacy-validate";

export type BackupScope = "full" | "financial" | "assets" | "reports";

export interface BackupBundle {
  meta: {
    app: "rasd";
    version: 1;
    scope: BackupScope;
    exported_at: string;
    user_id?: string;
    counts: Record<string, number>;
  };
  data: Record<string, any[]>;
  // Keyed by the raw localStorage key (e.g. "rasd.localPrefs.v1"), not by a
  // short alias — readLocalPrefs()/importUserData() both operate on the
  // real key strings directly. (The previous {localPrefs, reminderPrefs,
  // quickActions, ads} shape never matched what was actually written here —
  // fixed as a type-only correction in Prompt 24; no behavior change.)
  local?: Record<string, unknown>;
}

// Tables that carry user data. Order matters for restore (parents first).
const ALL_TABLES = [
  "profiles",
  "categories",
  "wallet_tx_categories",
  "contacts",
  "projects",
  "wallets",
  "wallet_transactions",
  "expenses",
  "recurring_expenses",
  "person_ledger",
  "investments",
  "investment_transactions",
  "asset_market_values",
  "depreciation_profiles",
  "zakat_settings",
  "zakat_records",
  "system_events",
] as const;
export type BackupTable = (typeof ALL_TABLES)[number];

// Tables that DB triggers own — never restore into these.
const IMPORT_BLOCKLIST: string[] = ["transactions", "investment_transactions"];

const SCOPES: Record<BackupScope, BackupTable[]> = {
  full: [...ALL_TABLES],
  financial: [
    "profiles", "categories", "wallet_tx_categories", "contacts", "projects",
    "wallets", "wallet_transactions", "expenses", "recurring_expenses", "person_ledger",
  ],
  assets: [
    "investments", "investment_transactions", "asset_market_values", "depreciation_profiles",
  ],
  reports: [
    "wallets", "wallet_transactions", "expenses", "person_ledger", "investments",
  ],
};

// Prompt 24 remediation: two of the original 4 keys below never matched
// anything actually written to localStorage (found by Prompt 23's
// data-export-audit.ts) — "rasd.quickActions.v1" vs. the real
// "dashboard.quickActions.v1" (QuickActionsRow.tsx), and "rasd.ads.v1" vs.
// the real "rasd.adPrefs.v1" (ad-config.ts). They're kept below (not
// removed) so restoring an old backup that happens to carry them still
// round-trips those fields unchanged; the correct real keys are added
// alongside so new exports actually capture that data. Also newly added:
// notification settings/log, beta session tracker, and beta feedback —
// none of which were exported before. importUserData() already restores
// every key present in `bundle.local` generically (see below), so both
// old-shaped and new-shaped backups import correctly without any import
// code change.
const LOCAL_KEYS = [
  "rasd.localPrefs.v1",
  "rasd.reminderPrefs.v1",
  "rasd.quickActions.v1", // legacy — never actually written; kept for backward compatibility
  "rasd.ads.v1", // legacy — never actually written; kept for backward compatibility
  "dashboard.quickActions.v1", // real key (QuickActionsRow.tsx)
  "rasd.adPrefs.v1", // real key (ad-config.ts AD_PREFS_KEY)
  "rasd.notificationSettings.v1", // notifications/config.ts
  "rasd.notificationLog.v1", // notifications/store.ts
  "rasd.betaSessions.v1", // beta/session.ts
  "rasd.betaFeedback.v1", // ux/feedback.ts
];

// -------------------- Export --------------------

export async function exportUserData(scope: BackupScope = "full"): Promise<BackupBundle> {
  const tables = SCOPES[scope];
  const data: Record<string, any[]> = {};
  const counts: Record<string, number> = {};

  for (const t of tables) {
    // Supabase Data API normally limits SELECT results to 1,000 records per
    // request. Never silently truncate a user's financial backup.
    const rows = await readAllBackupRows(
      (start, end) => supabase.from(t as any)
        .select("*", { count: "exact" })
        .order("id", { ascending: true })
        .range(start, end),
      t,
    );
    data[t] = rows;
    counts[t] = rows.length;
  }

  const { data: session } = await supabase.auth.getUser();
  const bundle: BackupBundle = {
    meta: {
      app: "rasd",
      version: 1,
      scope,
      exported_at: new Date().toISOString(),
      user_id: session?.user?.id,
      counts,
    },
    data,
    local: readLocalPrefs(),
  };

  // Do NOT silently persist unencrypted financial data in IndexedDB or
  // localStorage. Older persisted backups remain recoverable until the user
  // explicitly removes them; new exports are downloaded to their chosen file.
  return bundle;
}

function readLocalPrefs() {
  const out: any = {};
  for (const k of LOCAL_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) out[k] = JSON.parse(raw);
    } catch { /* ignore */ }
  }
  return out;
}

// -------------------- File writers --------------------

export function downloadJSON(bundle: BackupBundle, filename?: string) {
  const name = filename ?? `rasd-backup-${bundle.meta.scope}-${stamp()}.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  triggerDownload(blob, name);
}

export function downloadCSVZip(bundle: BackupBundle) {
  // No archiver — write one CSV per table by concatenation into a single file
  // with clear section headers (fast, dependency-free).
  const parts: string[] = [];
  for (const [table, rows] of Object.entries(bundle.data)) {
    parts.push(`# TABLE: ${table} (${rows.length} rows)`);
    parts.push(toCSV(rows));
    parts.push("");
  }
  const blob = new Blob([parts.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `rasd-backup-${bundle.meta.scope}-${stamp()}.csv`);
}

export function downloadXLSX(bundle: BackupBundle) {
  const wb = XLSX.utils.book_new();
  // Meta sheet
  const metaRows = [
    ["app", bundle.meta.app],
    ["version", bundle.meta.version],
    ["scope", bundle.meta.scope],
    ["exported_at", bundle.meta.exported_at],
    ["user_id", bundle.meta.user_id ?? ""],
    [],
    ["table", "rows"],
    ...Object.entries(bundle.meta.counts),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), "_meta");

  for (const [table, rows] of Object.entries(bundle.data)) {
    const ws = rows.length
      ? XLSX.utils.json_to_sheet(rows.map(flattenForSheet))
      : XLSX.utils.aoa_to_sheet([["(empty)"]]);
    XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
  }
  XLSX.writeFile(wb, `rasd-backup-${bundle.meta.scope}-${stamp()}.xlsx`);
}

function flattenForSheet(row: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v && typeof v === "object" ? JSON.stringify(v) : v;
  }
  return out;
}

function toCSV(rows: any[]) {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce((s: Set<string>, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// -------------------- Local cache (IndexedDB w/ localStorage fallback) --------------------

const IDB_NAME = "rasd-backup";
const IDB_STORE = "bundles";
const LS_KEY = "rasd.lastBackup.v1";

export async function saveLastBackup(bundle: BackupBundle) {
  try {
    await idbPut("last", bundle);
  } catch {
    try { localStorage.setItem(LS_KEY, JSON.stringify(bundle)); } catch { /* quota */ }
  }
}

export async function loadLastBackup(): Promise<BackupBundle | null> {
  // Historical plaintext snapshots may still exist. Do not expose one
  // user's cached financial data when another account uses the same browser.
  const { data: authData, error } = await supabase.auth.getUser();
  if (error || !authData.user) return null;
  let cached: BackupBundle | null = null;
  try {
    cached = await idbGet<BackupBundle>("last");
  } catch { /* fall through to old localStorage key */ }
  if (!cached) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      cached = raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  return cached?.meta?.user_id === authData.user.id ? cached : null;
}

export async function clearLegacyPlaintextBackup(): Promise<void> {
  let dbError: unknown;
  try { await idbDelete("last"); } catch (error) { dbError = error; }
  // Always attempt both cleanup paths even if IndexedDB fails.
  try { localStorage.removeItem(LS_KEY); }
  catch (error) {
    throw new Error("تعذر حذف النسخة القديمة من التخزين المحلي: " +
      (error instanceof Error ? error.message : "unknown error"));
  }
  if (dbError) {
    throw new Error("تعذر مسح النسخة من IndexedDB. يرجى مسح بيانات موقع رصد من إعدادات المتصفح.");
  }
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbPut(key: string, val: any) {
  const db = await idbOpen();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet<T>(key: string): Promise<T | null> {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => res((r.result as T) ?? null);
    r.onerror = () => rej(r.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

// -------------------- Import / Restore --------------------

export type ImportMode = "preview" | "merge" | "replace";

export interface ImportPlanEntry {
  table: string;
  incoming: number;
  existing: number;
  new_rows: number;
  duplicates: number;
  skipped_reason?: string;
}
export interface ImportPlan {
  scope: BackupScope;
  entries: ImportPlanEntry[];
  warnings: string[];
  valid: boolean;
}

export function validateBundle(raw: unknown): { ok: true; bundle: BackupBundle } | { ok: false; error: string } {
  const result = validateLegacyBackup(raw, new Set(ALL_TABLES), new Set(LOCAL_KEYS));
  return result.ok
    ? { ok: true, bundle: raw as BackupBundle }
    : { ok: false, error: result.error };
}

export async function planImport(bundle: BackupBundle): Promise<ImportPlan> {
  const validation = validateBundle(bundle);
  if (!validation.ok) throw new Error(validation.error);
  const entries: ImportPlanEntry[] = [];
  const warnings: string[] = [];
  for (const [table, rows] of Object.entries(bundle.data)) {
    if (IMPORT_BLOCKLIST.includes(table)) {
      entries.push({ table, incoming: rows.length, existing: 0, new_rows: 0, duplicates: 0, skipped_reason: "مُدار بواسطة القاعدة" });
      continue;
    }
    let existing: { id: string }[];
    try {
      existing = await readAllBackupRows(
        (start, end) => supabase.from(table as any)
          .select("id", { count: "exact" })
          .order("id", { ascending: true })
          .range(start, end),
        table,
      );
    } catch (error) {
      warnings.push(`${table}: ${error instanceof Error ? error.message : "تعذر قراءة سجلات الحساب"}`);
      entries.push({ table, incoming: rows.length, existing: 0, new_rows: rows.length, duplicates: 0 });
      continue;
    }
    const existingIds = new Set(existing.map((r) => r.id));
    let dupes = 0;
    for (const r of rows) if (r?.id && existingIds.has(r.id)) dupes++;
    entries.push({
      table,
      incoming: rows.length,
      existing: existingIds.size,
      new_rows: rows.length - dupes,
      duplicates: dupes,
    });
  }
  return { scope: bundle.meta.scope, entries, warnings, valid: warnings.length === 0 };
}

export interface ImportResult {
  inserted: Record<string, number>;
  updated: Record<string, number>;
  skipped: Record<string, number>;
  errors: { table: string; message: string }[];
}

export async function importUserData(
  bundle: BackupBundle,
  opts: { mode: ImportMode }
): Promise<ImportResult> {
  const res: ImportResult = { inserted: {}, updated: {}, skipped: {}, errors: [] };
  if (opts.mode === "preview") return res;

  const validation = validateBundle(bundle);
  if (!validation.ok) throw new Error(validation.error);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("يجب تسجيل الدخول لاستعادة بيانات رصد");
  const uid = authData.user.id;
  if (bundle.meta.user_id && bundle.meta.user_id !== uid) {
    throw new Error("النسخة القديمة تخص حساباً آخر؛ لا يمكن دمجها في الحساب الحالي");
  }
  for (const [table, rows] of Object.entries(bundle.data)) {
    if (rows.some(row => (
      (row.user_id !== undefined && row.user_id !== uid)
      || (table === "profiles" && row.id !== uid)
    ))) {
      throw new Error(`ملف النسخة يتضمن سجلات لا تخص حسابك: ${table}`);
    }
  }

  // v1 performs many independent client-side mutations without a database
  // transaction. A failed INSERT after the DELETE phase can destroy balances
  // permanently. The v2 restore_user_backup RPC is transactional instead.
  // Disallow this unsafe path even if a caller bypasses the settings UI.
  if (opts.mode === "replace") {
    throw new Error("الاستبدال الكامل من النسخ القديمة v1 غير آمن؛ استخدم استعادة النسخ v2 المعتمدة على قاعدة البيانات");
  }

  for (const table of ALL_TABLES) {
    if (IMPORT_BLOCKLIST.includes(table)) { res.skipped[table] = bundle.data[table]?.length ?? 0; continue; }
    const rows = bundle.data[table];
    if (!rows || !rows.length) continue;
    // Upsert on id (Postgres will keep existing rows in merge mode unchanged
    // only when we set onConflict:ignoreDuplicates; here we prefer upsert so
    // updated columns from the backup win, matching user expectation for
    // an explicit restore action).
    const { error, count } = await supabase
      .from(table as any)
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false, count: "exact" });
    if (error) {
      // v1 merge is non-transactional. Stop on the FIRST failure to avoid
      // cascading partial modifications into dependent financial tables.
      res.errors.push({ table, message: error.message });
      break;
    }
    res.inserted[table] = count ?? rows.length;
  }

  // A partial database import must not also overwrite local preferences.
  if (res.errors.length > 0) return res;

  // Restore local prefs
  if (bundle.local) {
    for (const [k, v] of Object.entries(bundle.local)) {
      if (!LOCAL_KEYS.includes(k)) continue; // Defense in depth: never overwrite arbitrary keys.
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
    }
  }
  return res;
}

// -------------------- Future cloud providers (stubs) --------------------

export type CloudProvider = "google_drive" | "icloud" | "onedrive" | "dropbox";
export const CLOUD_PROVIDERS: { id: CloudProvider; label: string }[] = [
  { id: "google_drive", label: "Google Drive" },
  { id: "icloud", label: "iCloud" },
  { id: "onedrive", label: "OneDrive" },
  { id: "dropbox", label: "Dropbox" },
];
export async function uploadToCloud(_provider: CloudProvider, _bundle: BackupBundle): Promise<never> {
  throw new Error("لم يتم تفعيل المزامنة السحابية بعد");
}
