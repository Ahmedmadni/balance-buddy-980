// Pure decision logic for RouteProgressBar, kept dependency-free so it can
// be unit tested without pulling in React/router/query internals.
export function shouldShowRouteProgress(
  routerStatus: "idle" | "pending",
  fetchingCount: number,
): boolean {
  return routerStatus === "pending" || fetchingCount > 0;
}
