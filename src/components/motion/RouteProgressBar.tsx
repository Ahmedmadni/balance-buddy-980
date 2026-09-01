import { useRouterState } from "@tanstack/react-router";
import { useIsFetching } from "@tanstack/react-query";
import { shouldShowRouteProgress } from "./route-progress";

// Immediate (0-100ms) feedback that navigation is happening: a slim
// indeterminate bar shown while the router is resolving a route or the new
// route's initial queries are still in flight. Route data here comes from
// component-level useQuery calls rather than route loaders, so router
// `pending` state alone rarely fires — useIsFetching() is what actually
// covers the visible gap between clicking a link and the new page's data
// showing up.
export function RouteProgressBar() {
  const routerStatus = useRouterState({ select: (s) => s.status });
  const fetchingCount = useIsFetching();
  const visible = shouldShowRouteProgress(routerStatus, fetchingCount);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/10"
      role="status"
      aria-label="جارٍ التحميل"
    >
      <div className="h-full w-1/3 animate-[route-progress_0.9s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
