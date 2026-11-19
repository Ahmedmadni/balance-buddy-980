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

/**
 * V1 export is retired. Its unencrypted, user-ID-bearing files were being
 * saved to browser/Android storage. Use encrypted RPC-backed v2 instead.
 */
export async function exportUserData(_scope: BackupScope = "full"): Promise<BackupBundle> {
  throw new Error("تم إيقاف النسخ الاحتياطي v1 غير المشفر. استخدم النسخ المشفرة v2.");
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

/** V1 file writers were plaintext. Keep these exports as explicit safe failures. */
export function downloadJSON(_bundle: BackupBundle, _filename?: string): never {
  throw new Error("تم إيقاف تصدير نسخ v1 غير المشفرة؛ استخدم النسخ المشفرة v2.");
}
export function downloadCSVZip(_bundle: BackupBundle): never {
  throw new Error("تم إيقاف التصدير من أرشيف v1؛ استخدم تقارير رصد الحالية.");
}
export function downloadXLSX(_bundle: BackupBundle): never {
  throw new Error("تم إيقاف التصدير من أرشيف v1؛ استخدم تقارير رصد الحالية.");
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

/** Never persist new unencrypted v1 financial archives in browser storage. */
export async function saveLastBackup(_bundle: BackupBundle): Promise<void> {
  throw new Error("تم إيقاف تخزين نسخ v1 غير المشفرة.");
}

export async function loadLastBackup(): Promise<BackupBundle | null> {
  try {
    const v = await idbGet<BackupBundle>("last");
    if (v) return v;
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * User-initiated cleanup of historic plaintext cached v1 backups ONLY.
 * Does not affect external downloads, v2 exports or Supabase records.
 * Report failure if IndexedDB deletion fails rather than claiming success.
 */
export async function clearLastBackup(): Promise<void> {
  let dbFailure: unknown = null;
  if (typeof indexedDB !== "undefined") {
    try { await idbDelete("last"); } catch (error) { dbFailure = error; }
  }
  localStorage.removeItem(LS_KEY);
  if (dbFailure) throw new Error("تعذر مسح نسخة IndexedDB القديمة");
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
async function idbDelete(key: string): Promise<void> {
  const db = await idbOpen();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
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

export function validateBundle(raw: any): { ok: true; bundle: BackupBundle } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "الملف غير صالح" };
  if (raw.meta?.app !== "rasd") return { ok: false, error: "الملف ليس نسخة رصد" };
  if (raw.meta?.version !== 1) return { ok: false, error: "إصدار غير مدعوم" };
  if (!raw.data || typeof raw.data !== "object") return { ok: false, error: "لا توجد بيانات" };
  return { ok: true, bundle: raw as BackupBundle };
}

export async function planImport(bundle: BackupBundle): Promise<ImportPlan> {
  const entries: ImportPlanEntry[] = [];
  const warnings: string[] = [];
  for (const [table, rows] of Object.entries(bundle.data)) {
    if (IMPORT_BLOCKLIST.includes(table)) {
      entries.push({ table, incoming: rows.length, existing: 0, new_rows: 0, duplicates: 0, skipped_reason: "مُدار بواسطة القاعدة" });
      continue;
    }
    const { data: existing, error } = await supabase.from(table as any).select("id");
    if (error) {
      warnings.push(`${table}: ${error.message}`);
      entries.push({ table, incoming: rows.length, existing: 0, new_rows: rows.length, duplicates: 0 });
      continue;
    }
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
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

/**
 * Prevent the old table-by-table restore path from running. It was not
 * transactional and could delete some rows before failing to recreate others.
 * Database mutation now occurs ONLY through atomic restore_user_backup v2 RPC.
 */
export async function importUserData(
  _bundle: BackupBundle,
  opts: { mode: ImportMode },
): Promise<ImportResult> {
  if (opts.mode === "preview") {
    return { inserted: {}, updated: {}, skipped: {}, errors: [] };
  }
  throw new Error("استعادة v1 غير الآمنة معطلة. استخدم النسخة المشفرة v2.");
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
