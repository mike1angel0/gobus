import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { routeKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';
import type { components } from '@/api/generated/types';

/** Pagination parameters for the routes list endpoint. */
export interface RoutesParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
}

/** Request body for creating a route with stops. */
export type CreateRouteBody = components['schemas']['CreateRouteRequest'];

/**
 * React Query hook that fetches the authenticated provider's routes (paginated).
 *
 * Calls `GET /api/v1/routes` using the typed API client.
 *
 * @param params - Optional pagination parameters.
 * @returns A React Query result with the paginated route list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useRoutes({ page: 1, pageSize: 20 });
 * ```
 */
export function useRoutes(params: RoutesParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: routeKeys.lists({ page: params.page, pageSize: params.pageSize }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/routes', {
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
 * React Query hook that fetches a single route's details with stops.
 *
 * Calls `GET /api/v1/routes/{id}` using the typed API client.
 * The query is only enabled when `id` is a non-empty string.
 *
 * @param id - The route identifier.
 * @returns A React Query result with the route detail data including stops.
 *
 * @example
 * ```tsx
 * const { data } = useRouteDetail('route_abc123');
 * ```
 */
export function useRouteDetail(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: routeKeys.detail(id),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/routes/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    enabled: id.length > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * React Query mutation hook that creates a new route with stops.
 *
 * Calls `POST /api/v1/routes`. On success, invalidates route list queries
 * and shows a success toast. Surfaces API error details on failure.
 *
 * @returns A React Query mutation result for creating routes.
 *
 * @example
 * ```tsx
 * const createRoute = useCreateRoute();
 * createRoute.mutate({ name: 'Berlin - Prague', stops: [...] });
 * ```
 */
export function useCreateRoute() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: CreateRouteBody) => {
      const { data } = await client.POST('/api/v1/routes', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
      toast({ title: 'Route created', description: 'The route has been created successfully.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to create route',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that deletes a route.
 *
 * Calls `DELETE /api/v1/routes/{id}`. On success, invalidates route queries
 * and shows a success toast. The caller is responsible for showing a
 * confirmation dialog before invoking the mutation.
 *
 * @returns A React Query mutation result for deleting routes.
 *
 * @example
 * ```tsx
 * const deleteRoute = useDeleteRoute();
 * deleteRoute.mutate('route_abc123');
 * ```
 */
export function useDeleteRoute() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await client.DELETE('/api/v1/routes/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
      toast({ title: 'Route deleted', description: 'The route has been deleted.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to delete route',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}
