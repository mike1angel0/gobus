import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { busKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';
import type { components } from '@/api/generated/types';

/** Pagination parameters for the buses list endpoint. */
export interface BusesParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
}

/** Request body for creating a bus with seat layout. */
export type CreateBusBody = components['schemas']['CreateBusRequest'];

/** Request body for updating bus details. */
export type UpdateBusBody = components['schemas']['UpdateBusRequest'];

/**
 * React Query hook that fetches the authenticated provider's buses (paginated).
 *
 * Calls `GET /api/v1/buses` using the typed API client.
 *
 * @param params - Optional pagination parameters.
 * @returns A React Query result with the paginated bus list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useBuses({ page: 1 });
 * ```
 */
export function useBuses(params: BusesParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: busKeys.lists({ page: params.page, pageSize: params.pageSize }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/buses', {
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
 * React Query hook that fetches a single bus's details with seat layout.
 *
 * Calls `GET /api/v1/buses/{id}` using the typed API client.
 * The query is only enabled when `id` is a non-empty string.
 *
 * @param id - The bus identifier.
 * @returns A React Query result with the bus detail data including seats.
 *
 * @example
 * ```tsx
 * const { data } = useBusDetail('bus_abc123');
 * ```
 */
export function useBusDetail(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: busKeys.detail(id),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/buses/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    enabled: id.length > 0,
    staleTime: 60 * 1000,
  });
}

/**
 * React Query mutation hook that creates a new bus with seat layout.
 *
 * Calls `POST /api/v1/buses`. On success, invalidates bus list queries
 * and shows a success toast. Handles 409 license plate conflict errors.
 *
 * @returns A React Query mutation result for creating buses.
 *
 * @example
 * ```tsx
 * const createBus = useCreateBus();
 * createBus.mutate({ licensePlate: 'AB-123', model: 'Mercedes', ... });
 * ```
 */
export function useCreateBus() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: CreateBusBody) => {
      const { data } = await client.POST('/api/v1/buses', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: busKeys.all });
      toast({ title: 'Bus created', description: 'The bus has been added to your fleet.' });
    },
    onError: (error: unknown) => {
      if (isApiError(error) && error.status === 409) {
        toast({
          title: 'License plate conflict',
          description: 'A bus with this license plate already exists.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Failed to create bus',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that updates a bus's details.
 *
 * Calls `PUT /api/v1/buses/{id}`. On success, invalidates bus queries
 * and shows a success toast.
 *
 * @returns A React Query mutation result for updating buses.
 *
 * @example
 * ```tsx
 * const updateBus = useUpdateBus();
 * updateBus.mutate({ id: 'bus_abc123', body: { model: 'Volvo 9700' } });
 * ```
 */
export function useUpdateBus() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateBusBody }) => {
      const { data } = await client.PUT('/api/v1/buses/{id}', {
        params: { path: { id } },
        body,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: busKeys.all });
      toast({ title: 'Bus updated', description: 'The bus details have been updated.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to update bus',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that deletes a bus.
 *
 * Calls `DELETE /api/v1/buses/{id}`. On success, invalidates bus queries
 * and shows a success toast. The caller is responsible for showing a
 * confirmation dialog before invoking the mutation.
 *
 * @returns A React Query mutation result for deleting buses.
 *
 * @example
 * ```tsx
 * const deleteBus = useDeleteBus();
 * deleteBus.mutate('bus_abc123');
 * ```
 */
export function useDeleteBus() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await client.DELETE('/api/v1/buses/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: busKeys.all });
      toast({ title: 'Bus deleted', description: 'The bus has been removed from your fleet.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to delete bus',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query hook that fetches available bus templates.
 *
 * Calls `GET /api/v1/buses/templates` using the typed API client.
 * Templates are pre-defined seat layout configurations for common bus types.
 *
 * @returns A React Query result with the bus templates list.
 *
 * @example
 * ```tsx
 * const { data } = useBusTemplates();
 * ```
 */
export function useBusTemplates() {
  const client = useApiClient();

  return useQuery({
    queryKey: [...busKeys.all, 'templates'] as const,
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/buses/templates');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
