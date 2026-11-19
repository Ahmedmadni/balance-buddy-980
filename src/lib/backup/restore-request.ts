/**
 * Guard a destructive v2 restore against account switching, stale session
 * context, and ambiguous HTTP/network results. An RPC that was sent but did
 * not yield a confirmed response must never be automatically retried.
 */
export type RestoreRequestOutcome = "committed" | "rejected" | "unconfirmed" | "blocked";

export interface RestoreRpcResponse {
  data?: unknown;
  error?: { code?: string | null } | null;
  status?: number | null;
}

export function classifyRestoreResponse(response: RestoreRpcResponse): Exclude<RestoreRequestOutcome, "blocked"> {
  if (!response.error) {
    const data = response.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const result = data as Record<string, unknown>;
      if (result.ok === true && result.format === "rasd-backup" && result.version === 2) {
        return "committed";
      }
    }
    // A 2xx without the SQL RPC's explicit success marker is not proof.
    return "unconfirmed";
  }
  // Known client/SQL rejection means PostgreSQL rolled back that statement.
  // 408 and 429 may conceal a request that was already sent, so stay cautious.
  const status = response.status;
  return typeof status === "number" &&
    status >= 400 && status < 500 && status !== 408 && status !== 429
    ? "rejected" : "unconfirmed";
}

export async function runGuardedBackupRestore(
  previewUserId: string | null,
  getCurrentUserId: () => Promise<string | null>,
  sendRestore: () => Promise<RestoreRpcResponse>,
): Promise<RestoreRequestOutcome> {
  if (!previewUserId) return "blocked";
  let actualUserId: string | null;
  try {
    actualUserId = await getCurrentUserId();
  } catch {
    // Authentication is required before making any destructive request.
    return "blocked";
  }
  if (!actualUserId || actualUserId !== previewUserId) return "blocked";
  try {
    return classifyRestoreResponse(await sendRestore());
  } catch {
    // A transport exception does not prove that the server did not commit.
    return "unconfirmed";
  }
}
