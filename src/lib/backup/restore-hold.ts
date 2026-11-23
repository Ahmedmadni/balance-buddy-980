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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeHold(raw: string | null): { state: "pending" | "unconfirmed"; operationId: string | null } | "unavailable" | null {
  if (raw === null) return null;
  if (raw === "pending" || raw === "unconfirmed") return { state: raw, operationId: null };
  const match = /^(pending|unconfirmed):([0-9a-f-]{36})$/i.exec(raw);
  if (match && UUID.test(match[2])) {
    return { state: match[1] as "pending" | "unconfirmed", operationId: match[2] };
  }
  return "unavailable";
}

export function readRestoreHold(storage: RestoreHoldStorage, userId: string): RestoreHoldState {
  if (!userId) return "unavailable";
  try {
    const record = decodeHold(storage.getItem(keyFor(userId)));
    if (record === null || record === "unavailable") return record;
    return record.state;
  } catch {
    return "unavailable";
  }
}

/** The operation UUID survives an Android WebView crash in the same journal entry. */
export function readRestoreOperationId(storage: RestoreHoldStorage, userId: string): string | null {
  if (!userId) return null;
  try {
    const record = decodeHold(storage.getItem(keyFor(userId)));
    return record && record !== "unavailable" ? record.operationId : null;
  } catch {
    return null;
  }
}

/** Write BEFORE sending the RPC. Failure to persist must prevent the call. */
export function reserveRestoreHold(
  storage: RestoreHoldStorage,
  userId: string,
  operationId?: string,
): boolean {
  if (readRestoreHold(storage, userId) !== null) return false;
  if (operationId !== undefined && !UUID.test(operationId)) return false;
  try {
    storage.setItem(keyFor(userId), operationId ? `pending:${operationId}` : "pending");
    return readRestoreHold(storage, userId) === "pending" &&
      readRestoreOperationId(storage, userId) === (operationId ?? null);
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
    const state = readRestoreHold(storage, userId);
    if (state === "unavailable" || state === null) return;
    if (outcome === "committed" || outcome === "rejected") {
      storage.removeItem(keyFor(userId));
    } else {
      const operationId = readRestoreOperationId(storage, userId);
      storage.setItem(keyFor(userId), operationId ? `unconfirmed:${operationId}` : "unconfirmed");
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

/** Accessing window.localStorage itself can throw in restricted WebViews. */
const unavailableStorage: RestoreHoldStorage = {
  getItem: () => { throw new Error("restore journal unavailable"); },
  setItem: () => { throw new Error("restore journal unavailable"); },
  removeItem: () => { throw new Error("restore journal unavailable"); },
};

export function getRestoreHoldStorage(): RestoreHoldStorage {
  try {
    return typeof window !== "undefined" ? window.localStorage : unavailableStorage;
  } catch {
    return unavailableStorage;
  }
}
