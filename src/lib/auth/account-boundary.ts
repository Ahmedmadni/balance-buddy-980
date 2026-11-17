/**
 * React Query keys are currently not uniformly scoped by user ID.
 * Never reuse a previous account's cached financial records on an
 * in-place session change, even if both sessions are authenticated.
 */
export function shouldClearFinancialCache(
  event: string,
  previousUserId: string | null,
  nextUserId: string | null,
): boolean {
  if (event === "SIGNED_OUT") return true;
  return event === "SIGNED_IN" &&
    previousUserId !== null &&
    nextUserId !== previousUserId;
}
