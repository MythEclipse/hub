import { QueryClient } from "@tanstack/react-query";

export function getQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The dashboard polls on an interval; refetching on every window focus
        // would multiply Prometheus scrapes for no benefit.
        refetchOnWindowFocus: false,
        staleTime: 10_000,
        retry: 1,
      },
    },
  });
}
