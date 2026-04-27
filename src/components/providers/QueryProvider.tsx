"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";

/**
 * App-wide TanStack Query client. Defaults tuned for a small mobile
 * PWA: short stale-time so manual refreshes still feel snappy, but a
 * generous gc-time so a re-mount (e.g. opening the same place sheet
 * twice) hits the cache instead of the network.
 *
 * No retry on 4xx — server actions surface 401/403/404 deliberately
 * and a retry would just delay the error. Network blips on 5xx still
 * retry once.
 */
const config: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Lazy-init so the client is created once per browser session.
  // Re-rendering the layout never throws away the cache.
  const [client] = useState(() => new QueryClient(config));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
