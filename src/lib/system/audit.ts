// =============================================================
// Audit Layer — createAuditEntry()
// -------------------------------------------------------------
// Records discrete, low-frequency user actions (login, logout, import,
// export, backup, restore, delete, archive, major settings changes) for
// the Beta Diagnostics dashboard. Stored in localStorage only — no new
// Supabase table, no schema change (same convention as the notification
// log in src/lib/notifications/store.ts).
//
// Explicitly NOT for: daily financial operations, `transactions` rows,
// `investment_transactions` rows, or any high-frequency action.
// =============================================================

export type AuditAction =
  | "login"
  | "logout"
  | "import"
  | "export"
  | "backup"
  | "restore"
  | "delete"
  | "archive"
  | "settings_change";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  summary: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

const KEY = "rasd.auditLog.v1";
const MAX_ENTRIES = 500;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadAuditLog(): AuditEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persist(log: AuditEntry[]) {
  if (typeof localStorage === "undefined") return;
  const trimmed = log
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — best effort */
  }
}

export function createAuditEntry(
  action: AuditAction,
  summary: string,
  opts: { entityType?: string; entityId?: string; meta?: Record<string, unknown> } = {},
): AuditEntry {
  const entry: AuditEntry = {
    id: uuid(),
    action,
    summary,
    entityType: opts.entityType,
    entityId: opts.entityId,
    meta: opts.meta,
    createdAt: new Date().toISOString(),
  };
  const log = loadAuditLog();
  log.push(entry);
  persist(log);
  return entry;
}

export function clearAuditLog() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  import: "استيراد بيانات",
  export: "تصدير بيانات",
  backup: "نسخة احتياطية",
  restore: "استعادة بيانات",
  delete: "حذف",
  archive: "أرشفة",
  settings_change: "تغيير إعدادات رئيسي",
};
