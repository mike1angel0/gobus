import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { ApiError } from '@/api/errors';
import { trackingKeys } from '@/api/keys';

/**
 * React Query hook that fetches live GPS tracking data for a specific bus.
 *
 * Calls `GET /api/v1/tracking/{busId}` using the typed API client.
 * The query is only enabled when `busId` is a non-empty string and `enabled` is true.
 * Uses a short staleTime (5s) since tracking data changes frequently.
 *
 * @param busId - The bus identifier to track.
 * @param enabled - Whether the query should be active. Defaults to `true`.
 * @returns A React Query result with the bus tracking data.
 *
 * @example
 * ```tsx
 * const { data } = useBusTracking('bus_abc123', isExpanded);
 * ```
 */
export function useBusTracking(busId: string, enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: trackingKeys.detail(busId),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/tracking/{busId}', {
        params: { path: { busId } },
      });
      return data;
    },
    enabled: busId.length > 0 && enabled,
    staleTime: 5 * 1000,
    refetchInterval: enabled ? 10 * 1000 : false,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 3;
    },
  });
}
