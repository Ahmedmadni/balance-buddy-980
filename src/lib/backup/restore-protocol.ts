/** Pure compatibility negotiation for a staged server migration. */
export interface RestoreStatusResponse {
  data?: unknown;
  error?: { code?: string | null } | null;
  status?: number | null;
}

export type RestoreApiMode = "once" | "legacy" | "unavailable";
export type ServerRestoreStatus = "committed" | "not_found" | "unavailable";

function matchingData(response: RestoreStatusResponse, operationId: string): Record<string, unknown> | null {
  const data = response.data;
  if (response.error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const object = data as Record<string, unknown>;
  return object.operation_id === operationId ? object : null;
}

/** Only a definite RPC-not-found response permits the backwards-compatible path. */
export function selectRestoreApiMode(response: RestoreStatusResponse, operationId: string): RestoreApiMode {
  if (response.error?.code === "PGRST202") return "legacy";
  const data = matchingData(response, operationId);
  return data?.status === "not_found" ? "once" : "unavailable";
}

export function classifyServerRestoreStatus(response: RestoreStatusResponse, operationId: string): ServerRestoreStatus {
  const data = matchingData(response, operationId);
  if (data?.status === "not_found") return "not_found";
  if (data?.status === "committed" && data.format === "rasd-backup" && data.version === 2) return "committed";
  return "unavailable";
}
