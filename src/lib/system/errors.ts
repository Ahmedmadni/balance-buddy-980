// =============================================================
// Error Tracking — captureApplicationError()
// -------------------------------------------------------------
// Local-only error log (localStorage), independent from and additive to
// the existing src/lib/error-capture.ts (SSR crash recovery) and
// src/lib/lovable-error-reporting.ts (Lovable platform's own error
// boundary hook) — neither of those is modified. This module exists so
// the Beta Diagnostics dashboard (/app/system) has something to read;
// it never sends data anywhere (no Sentry/Firebase/remote logging).
// =============================================================

export type ErrorCategory = "runtime" | "network" | "import" | "backup" | "notification";

export interface ErrorEntry {
  id: string;
  category: ErrorCategory;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

const KEY = "rasd.errorLog.v1";
const MAX_ENTRIES = 300;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function messageOf(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function loadErrorLog(): ErrorEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persist(log: ErrorEntry[]) {
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

export function captureApplicationError(
  error: unknown,
  category: ErrorCategory,
  context?: Record<string, unknown>,
): ErrorEntry {
  const { message, stack } = messageOf(error);
  const entry: ErrorEntry = {
    id: uuid(),
    category,
    message,
    stack,
    context,
    createdAt: new Date().toISOString(),
  };
  const log = loadErrorLog();
  log.push(entry);
  persist(log);
  if (import.meta.env?.DEV) console.error(`[captureApplicationError:${category}]`, error, context);
  return entry;
}

export function clearErrorLog() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}

/** Passive window listeners for uncaught runtime/network errors. Idempotent — safe to call once at app root. */
export function initErrorTracking() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __rasdErrorTrackingInit?: boolean };
  if (w.__rasdErrorTrackingInit) return;
  w.__rasdErrorTrackingInit = true;

  window.addEventListener("error", (event) => {
    captureApplicationError(event.error ?? event.message, "runtime", { source: "window.onerror" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const category: ErrorCategory =
      reason instanceof Error && /fetch|network|NetworkError/i.test(reason.message)
        ? "network"
        : "runtime";
    captureApplicationError(reason, category, { source: "unhandledrejection" });
  });
}

export const ERROR_CATEGORY_LABEL: Record<ErrorCategory, string> = {
  runtime: "خطأ تشغيلي",
  network: "خطأ شبكة",
  import: "خطأ استيراد",
  backup: "خطأ نسخ احتياطي",
  notification: "خطأ إشعارات",
};
