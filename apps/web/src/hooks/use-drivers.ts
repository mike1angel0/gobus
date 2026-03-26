import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { driverKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';
import type { components } from '@/api/generated/types';

/** Pagination parameters for the drivers list endpoint. */
export interface DriversParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
}

/** Request body for creating a driver account. */
export type CreateDriverBody = components['schemas']['CreateDriverRequest'];

/**
 * React Query hook that fetches the authenticated provider's drivers (paginated).
 *
 * Calls `GET /api/v1/drivers` using the typed API client.
 *
 * @param params - Optional pagination parameters.
 * @returns A React Query result with the paginated driver list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDrivers({ page: 1 });
 * ```
 */
export function useDrivers(params: DriversParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: driverKeys.lists({ page: params.page, pageSize: params.pageSize }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/drivers', {
        params: {
          query: {
            page: params.page,
            pageSize: params.pageSize,
          },
        },
      });
      return data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * React Query mutation hook that creates a new driver account.
 *
 * Calls `POST /api/v1/drivers`. On success, invalidates driver list queries
 * and shows a success toast. Handles 409 email conflict errors with a
 * specific message.
 *
 * @returns A React Query mutation result for creating drivers.
 *
 * @example
 * ```tsx
 * const createDriver = useCreateDriver();
 * createDriver.mutate({ name: 'John', email: 'john@example.com', password: 'Pass1234' });
 * ```
 */
export function useCreateDriver() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: CreateDriverBody) => {
      const { data } = await client.POST('/api/v1/drivers', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
      toast({
        title: 'Driver created',
        description: 'The driver account has been created successfully.',
      });
    },
    onError: (error: unknown) => {
      if (isApiError(error) && error.status === 409) {
        toast({
          title: 'Email already in use',
          description: 'A user with this email address already exists.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Failed to create driver',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that deletes a driver account.
 *
 * Calls `DELETE /api/v1/drivers/{id}`. On success, invalidates driver queries
 * and shows a success toast. The caller is responsible for showing a
 * confirmation dialog before invoking the mutation.
 *
 * @returns A React Query mutation result for deleting drivers.
 *
 * @example
 * ```tsx
 * const deleteDriver = useDeleteDriver();
 * deleteDriver.mutate('driver_abc123');
 * ```
 */
export function useDeleteDriver() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await client.DELETE('/api/v1/drivers/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
      toast({ title: 'Driver deleted', description: 'The driver account has been removed.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to delete driver',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}
