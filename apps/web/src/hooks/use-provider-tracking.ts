import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { trackingKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';
import type { components } from '@/api/generated/types';

/** Request body for updating a bus's GPS position. */
export type TrackingUpdateBody = components['schemas']['TrackingUpdate'];

/**
 * React Query hook that fetches live tracking data for a specific bus with polling.
 *
 * Calls `GET /api/v1/tracking/{busId}` with a 5-second polling interval.
 * The query is only enabled when `busId` is non-empty and `enabled` is true.
 *
 * @param busId - The bus identifier to track.
 * @param enabled - Whether the query should be active. Defaults to `true`.
 * @returns A React Query result with the bus tracking data.
 *
 * @example
 * ```tsx
 * const { data } = useTracking('bus_abc123');
 * ```
 */
export function useTracking(busId: string, enabled = true) {
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
    refetchInterval: enabled ? 5 * 1000 : false,
  });
}

/**
 * React Query mutation hook that updates a bus's GPS position.
 *
 * Calls `POST /api/v1/tracking`. On success, invalidates the specific bus's
 * tracking query. Only DRIVER role can update tracking. Shows toast on error.
 *
 * @returns A React Query mutation result for updating tracking positions.
 *
 * @example
 * ```tsx
 * const updateTracking = useUpdateTracking();
 * updateTracking.mutate({ busId: 'bus_1', lat: 52.52, lng: 13.405, speed: 60, heading: 90, currentStopIndex: 2 });
 * ```
 */
export function useUpdateTracking() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: TrackingUpdateBody) => {
      const { data } = await client.POST('/api/v1/tracking', { body });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: trackingKeys.detail(variables.busId) });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Tracking update failed',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query hook that fetches tracking data for multiple buses.
 *
 * Wraps multiple `useTracking` calls by fetching individual bus positions.
 * Uses the tracking list query key for cache management. Polls every 5 seconds.
 *
 * Note: The API does not have a provider-level batch tracking endpoint.
 * This hook fetches tracking for a single bus at a time. For provider tracking
 * pages, call `useTracking` for each active bus individually.
 *
 * @param busIds - Array of bus identifiers to track.
 * @param enabled - Whether polling should be active. Defaults to `true`.
 * @returns A React Query result with tracking data for the specified buses.
 *
 * @example
 * ```tsx
 * const { data } = useProviderTracking(['bus_1', 'bus_2']);
 * ```
 */
export function useProviderTracking(busIds: string[], enabled = true) {
  const client = useApiClient();

  return useQuery({
    queryKey: trackingKeys.lists({ busId: busIds.join(',') }),
    queryFn: async () => {
      const results = await Promise.all(
        busIds.map(async (busId) => {
          try {
            const { data } = await client.GET('/api/v1/tracking/{busId}', {
              params: { path: { busId } },
            });
            return data;
          } catch {
            return null;
          }
        }),
      );
      return results.filter(Boolean);
    },
    enabled: busIds.length > 0 && enabled,
    staleTime: 5 * 1000,
    refetchInterval: enabled ? 5 * 1000 : false,
  });
}
