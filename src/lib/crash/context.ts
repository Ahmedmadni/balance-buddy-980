// =============================================================
// PART 2 — Crash Reporting Abstraction: user/context state
// -------------------------------------------------------------
// In-memory only (mirrors how Sentry's SDK scope works) — reset on
// reload. Nothing here is persisted or sent anywhere by itself; it's
// merged into each capture call by provider.ts's facade functions.
// =============================================================

export interface CrashUser {
  id?: string;
  email?: string;
  [key: string]: unknown;
}

let currentUser: CrashUser | null = null;
let currentContext: Record<string, Record<string, unknown>> = {};

export function setUser(user: CrashUser | null): void {
  currentUser = user;
}

export function getUser(): CrashUser | null {
  return currentUser;
}

export function setContext(key: string, value: Record<string, unknown>): void {
  currentContext[key] = value;
}

export function getContext(): Record<string, Record<string, unknown>> {
  return { ...currentContext };
}

export function clearContext(): void {
  currentContext = {};
}
