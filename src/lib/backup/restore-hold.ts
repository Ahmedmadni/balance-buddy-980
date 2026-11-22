/**
 * A fail-closed, account-scoped local safety journal for destructive restores.
 * No backup contents, balances, or passwords are written to browser storage.
 * This protects against WebView restarts, but cannot replace server-side
 * idempotency across devices or simultaneous browsers.
 */
export const RESTORE_HOLD_PREFIX = "rasd:v2:restore-hold:v1:";

export type RestoreHoldState = "pending" | "unconfirmed" | "unavailable" | null;
export type SettledRestoreOutcome = "committed" | "rejected" | "unconfirmed";

export interface RestoreHoldStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function keyFor(userId: string): string {
  return `${RESTORE_HOLD_PREFIX}${userId}`;
}

export function readRestoreHold(storage: RestoreHoldStorage, userId: string): RestoreHoldState {
  if (!userId) return "unavailable";
  try {
    const value = storage.getItem(keyFor(userId));
    if (value === null) return null;
    return value === "pending" || value === "unconfirmed" ? value : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Write BEFORE sending the RPC. Failure to persist must prevent the call. */
export function reserveRestoreHold(storage: RestoreHoldStorage, userId: string): boolean {
  if (readRestoreHold(storage, userId) !== null) return false;
  try {
    storage.setItem(keyFor(userId), "pending");
    return readRestoreHold(storage, userId) === "pending";
  } catch {
    return false;
  }
}

/** A lost response keeps the hold. Only a definite result releases it. */
export function settleRestoreHold(
  storage: RestoreHoldStorage,
  userId: string,
  outcome: SettledRestoreOutcome,
): void {
  try {
    if (outcome === "committed" || outcome === "rejected") {
      storage.removeItem(keyFor(userId));
    } else {
      storage.setItem(keyFor(userId), "unconfirmed");
    }
  } catch {
    // Leaving an existing "pending" hold is safer than permitting a retry.
  }
}

/** Called only after explicit user review and fresh account verification. */
export function acknowledgeRestoreHold(storage: RestoreHoldStorage, userId: string): boolean {
  const existing = readRestoreHold(storage, userId);
  if (existing === null) return true;
  if (existing === "unavailable") return false;
  try {
    storage.removeItem(keyFor(userId));
    return readRestoreHold(storage, userId) === null;
  } catch {
    return false;
  }
}
