import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cached data from a previous visit renders immediately on
        // navigation; without a staleTime every route mount (including
        // revisits) also fires a background refetch for every query on the
        // page. 15s keeps navigation snappy while still refreshing well
        // within a normal session — mutations invalidate their own query
        // keys explicitly, so this doesn't mask stale writes.
        staleTime: 15_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
  });

  return router;
};
