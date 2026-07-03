// =============================================================
// PART 2 — Crash Reporting Abstraction: interface, facade, stubs
// -------------------------------------------------------------
// Public API surface used by the rest of the app: captureError(),
// captureException(), captureMessage(), setUser(), setContext(),
// clearContext() — all exported from here. The active provider is
// pluggable (setCrashProvider()); defaults to LocalCrashProvider
// (local.ts), which reuses the existing local error log (Prompt 17's
// system/errors.ts) instead of a second logging system.
//
// SentryProviderStub and FirebaseCrashlyticsStub are declared for a
// future real integration — no SDK is loaded, no network call is made;
// same convention as notifications/provider.ts's Push/Email/Sms stubs.
// =============================================================
import { getUser, getContext, setUser, setContext, clearContext } from "./context";
import { LocalCrashProvider } from "./local";

export type CrashLevel = "info" | "warning" | "error";

export interface CrashCaptureResult {
  ok: boolean;
  provider: string;
}

export interface CrashProvider {
  name: string;
  captureError(error: unknown, context?: Record<string, unknown>): CrashCaptureResult;
  captureException(error: unknown, context?: Record<string, unknown>): CrashCaptureResult;
  captureMessage(
    message: string,
    level: CrashLevel,
    context?: Record<string, unknown>,
  ): CrashCaptureResult;
}

export const SentryProviderStub: CrashProvider = {
  name: "sentry_stub",
  captureError(_error, _context) {
    // TODO: real Sentry SDK integration (@sentry/browser / @sentry/capacitor).
    return { ok: false, provider: "sentry_stub" };
  },
  captureException(_error, _context) {
    return { ok: false, provider: "sentry_stub" };
  },
  captureMessage(_message, _level, _context) {
    return { ok: false, provider: "sentry_stub" };
  },
};

export const FirebaseCrashlyticsStub: CrashProvider = {
  name: "firebase_crashlytics_stub",
  captureError(_error, _context) {
    // TODO: real Firebase Crashlytics integration (@capacitor-firebase/crashlytics).
    return { ok: false, provider: "firebase_crashlytics_stub" };
  },
  captureException(_error, _context) {
    return { ok: false, provider: "firebase_crashlytics_stub" };
  },
  captureMessage(_message, _level, _context) {
    return { ok: false, provider: "firebase_crashlytics_stub" };
  },
};

let activeProvider: CrashProvider = LocalCrashProvider;

export function setCrashProvider(provider: CrashProvider): void {
  activeProvider = provider;
}

export function getCrashProvider(): CrashProvider {
  return activeProvider;
}

function mergedContext(extra?: Record<string, unknown>): Record<string, unknown> {
  return { user: getUser(), ...getContext(), ...extra };
}

export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): CrashCaptureResult {
  return activeProvider.captureError(error, mergedContext(context));
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): CrashCaptureResult {
  return activeProvider.captureException(error, mergedContext(context));
}

export function captureMessage(
  message: string,
  level: CrashLevel = "info",
  context?: Record<string, unknown>,
): CrashCaptureResult {
  return activeProvider.captureMessage(message, level, mergedContext(context));
}

export { setUser, setContext, clearContext };
