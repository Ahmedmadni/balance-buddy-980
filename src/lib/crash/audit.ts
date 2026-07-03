// =============================================================
// PART 2 — Crash Reporting Abstraction: audit
// -------------------------------------------------------------
// Reuses loadErrorLog() from system/errors.ts directly — the same log
// LocalCrashProvider writes into — instead of tracking a second count
// somewhere else.
// =============================================================
import { loadErrorLog } from "@/lib/system/errors";
import { getCrashProvider } from "./provider";

export interface CrashStatusReport {
  activeProvider: string;
  errorCount: number;
  lastError: { message: string; category: string; createdAt: string } | null;
  errorRatePerDay: number; // errors in the last 24h
  generatedAt: string;
}

export function auditCrashReporting(): CrashStatusReport {
  const log = loadErrorLog();
  const sorted = [...log].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const last = sorted[0] ?? null;

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const errorRatePerDay = log.filter((e) => +new Date(e.createdAt) >= dayAgo).length;

  return {
    activeProvider: getCrashProvider().name,
    errorCount: log.length,
    lastError: last
      ? { message: last.message, category: last.category, createdAt: last.createdAt }
      : null,
    errorRatePerDay,
    generatedAt: new Date().toISOString(),
  };
}
