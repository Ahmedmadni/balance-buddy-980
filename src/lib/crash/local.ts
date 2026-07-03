// =============================================================
// PART 2 — Crash Reporting Abstraction: LocalCrashProvider
// -------------------------------------------------------------
// The one real, functioning provider — wraps captureApplicationError()
// from Prompt 17's system/errors.ts instead of keeping a second,
// separate local error log. Every capture ends up in the same
// rasd.errorLog.v1 store the Beta Diagnostics dashboard already reads.
// =============================================================
import { captureApplicationError } from "@/lib/system/errors";
import type { CrashProvider, CrashCaptureResult, CrashLevel } from "./provider";

function result(ok: boolean): CrashCaptureResult {
  return { ok, provider: "local" };
}

export const LocalCrashProvider: CrashProvider = {
  name: "local",
  captureError(error: unknown, context?: Record<string, unknown>): CrashCaptureResult {
    captureApplicationError(error, "runtime", context);
    return result(true);
  },
  captureException(error: unknown, context?: Record<string, unknown>): CrashCaptureResult {
    captureApplicationError(error, "runtime", context);
    return result(true);
  },
  captureMessage(
    message: string,
    level: CrashLevel,
    context?: Record<string, unknown>,
  ): CrashCaptureResult {
    captureApplicationError(`[${level}] ${message}`, "runtime", context);
    return result(true);
  },
};
