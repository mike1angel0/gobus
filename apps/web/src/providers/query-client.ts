import { QueryClient } from '@tanstack/react-query';

/**
 * Pre-configured QueryClient with sensible defaults for the Transio application.
 *
 * - `staleTime`: 30 seconds — avoids refetching data that was just fetched.
 * - `retry`: 1 — retries failed requests once before surfacing the error.
 * - `refetchOnWindowFocus`: false — prevents unexpected refetches when switching tabs.
 * - `gcTime`: 5 minutes — garbage-collects inactive cache entries after 5 min.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});
