import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { adminKeys, busKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';

/** Pagination and filter parameters for the admin buses list endpoint. */
export interface AdminBusesParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** Filter by provider ID. */
  providerId?: string;
}

/**
 * React Query hook that fetches all buses across all providers (admin only).
 *
 * Calls `GET /api/v1/admin/buses` using the typed API client.
 * Requires ADMIN role. Results are paginated and optionally filtered by provider.
 *
 * @param params - Optional pagination and filter parameters.
 * @returns A React Query result with the paginated bus list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAdminBuses({ page: 1, providerId: 'prov_abc' });
 * ```
 */
export function useAdminBuses(params: AdminBusesParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: adminKeys.buses({ page: params.page, pageSize: params.pageSize }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/admin/buses', {
        params: {
          query: {
            page: params.page,
            pageSize: params.pageSize,
            providerId: params.providerId,
          },
        },
      });
      return data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * React Query mutation hook that toggles a seat's enabled/disabled state (admin only).
 *
 * Calls `PATCH /api/v1/admin/seats/{id}`. On success, invalidates both admin bus
 * queries and provider bus queries so seat maps refresh everywhere.
 * Shows a toast on success or failure.
 *
 * @returns A React Query mutation result for toggling seat state.
 *
 * @example
 * ```tsx
 * const toggleSeat = useToggleSeat();
 * toggleSeat.mutate({ id: 'seat_abc', isEnabled: false });
 * ```
 */
export function useToggleSeat() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const { data } = await client.PATCH('/api/v1/admin/seats/{id}', {
        params: { path: { id } },
        body: { isEnabled },
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.buses() });
      queryClient.invalidateQueries({ queryKey: busKeys.all });
      toast({
        title: variables.isEnabled ? 'Seat enabled' : 'Seat disabled',
        description: variables.isEnabled
          ? 'The seat is now available for booking.'
          : 'The seat has been disabled.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to update seat',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}
