import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '@/api/generated/types';
import { useApiClient } from '@/api/hooks';
import { adminKeys, stationKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';

/** Station type from the OpenAPI spec. */
type StationType = components['schemas']['StationType'];

/** Pagination and filter parameters for the admin stations list endpoint. */
export interface AdminStationsParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** Filter by station type. */
  type?: StationType;
  /** Filter by city name. */
  city?: string;
  /** Filter by active status. */
  isActive?: boolean;
  /** Search by name or address. */
  search?: string;
}

/**
 * React Query hook that fetches all stations with optional filters (admin only).
 *
 * Calls `GET /api/v1/admin/stations` using the typed API client.
 * Requires ADMIN role.
 *
 * @param params - Optional pagination and filter parameters.
 * @returns A React Query result with the paginated station list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAdminStations({ page: 1, type: 'HUB' });
 * ```
 */
export function useAdminStations(params: AdminStationsParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: adminKeys.stations({
      page: params.page,
      pageSize: params.pageSize,
      type: params.type,
      city: params.city,
      isActive: params.isActive,
      search: params.search,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/admin/stations', {
        params: {
          query: {
            page: params.page,
            pageSize: params.pageSize,
            type: params.type,
            city: params.city,
            isActive: params.isActive,
            search: params.search,
          },
        },
      });
      return data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * React Query mutation hook that creates a new station (admin only).
 *
 * Calls `POST /api/v1/admin/stations`.
 * On success, invalidates admin station queries.
 *
 * @returns A React Query mutation result for creating a station.
 *
 * @example
 * ```tsx
 * const createStation = useCreateStation();
 * createStation.mutate({ name: 'Autogara Nord', cityName: 'București', ... });
 * ```
 */
export function useCreateStation() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: components['schemas']['CreateStationRequest']) => {
      const { data } = await client.POST('/api/v1/admin/stations', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.stations() });
      toast({ title: 'Station created', description: 'The station has been created successfully.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to create station',
        description: isApiError(error) ? (error.detail ?? error.title) : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that updates an existing station (admin only).
 *
 * Calls `PATCH /api/v1/admin/stations/{id}`.
 * On success, invalidates admin station queries.
 *
 * @returns A React Query mutation result for updating a station.
 *
 * @example
 * ```tsx
 * const updateStation = useUpdateStation();
 * updateStation.mutate({ id: 'station_abc', body: { name: 'New Name' } });
 * ```
 */
export function useUpdateStation() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: components['schemas']['UpdateStationRequest'] }) => {
      const { data } = await client.PATCH('/api/v1/admin/stations/{id}', {
        params: { path: { id } },
        body,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.stations() });
      toast({ title: 'Station updated', description: 'The station has been updated successfully.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to update station',
        description: isApiError(error) ? (error.detail ?? error.title) : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that deactivates a station (admin only).
 *
 * Calls `DELETE /api/v1/admin/stations/{id}`.
 * On success, invalidates admin station queries.
 *
 * @returns A React Query mutation result for deactivating a station.
 *
 * @example
 * ```tsx
 * const deactivateStation = useDeactivateStation();
 * deactivateStation.mutate({ id: 'station_abc' });
 * ```
 */
export function useDeactivateStation() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await client.DELETE('/api/v1/admin/stations/{id}', {
        params: { path: { id } },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.stations() });
      toast({ title: 'Station deactivated', description: 'The station has been deactivated.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to deactivate station',
        description: isApiError(error) ? (error.detail ?? error.title) : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that merges two stations (admin only).
 *
 * Calls `POST /api/v1/admin/stations/merge`.
 * On success, invalidates admin station queries.
 *
 * @returns A React Query mutation result for merging stations.
 *
 * @example
 * ```tsx
 * const mergeStations = useMergeStations();
 * mergeStations.mutate({ sourceId: 'station_a', targetId: 'station_b' });
 * ```
 */
export function useMergeStations() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: components['schemas']['MergeStationsRequest']) => {
      const { data } = await client.POST('/api/v1/admin/stations/merge', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.stations() });
      toast({ title: 'Stations merged', description: 'The stations have been merged successfully.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to merge stations',
        description: isApiError(error) ? (error.detail ?? error.title) : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that creates a new stop (provider only).
 *
 * Calls `POST /api/v1/stations` with provider-level stop data.
 * On success, invalidates station queries and shows a toast.
 *
 * @returns A React Query mutation result for creating a stop.
 */
export function useProviderCreateStop() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: components['schemas']['ProviderCreateStopRequest']) => {
      const { data } = await client.POST('/api/v1/stations', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stationKeys.all });
      toast({ title: 'Stop created', description: 'The stop has been created successfully.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to create stop',
        description: isApiError(error) ? (error.detail ?? error.title) : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query hook that searches active stations for the station picker.
 *
 * Calls `GET /api/v1/stations` using the typed API client.
 * Requires authentication (any role).
 *
 * @param params - Search and pagination parameters.
 * @returns A React Query result with the paginated station list.
 *
 * @example
 * ```tsx
 * const { data } = useSearchStations({ search: 'București' });
 * ```
 */
export function useSearchStations(params: { search?: string; page?: number; pageSize?: number } = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: stationKeys.lists({ search: params.search, page: params.page, pageSize: params.pageSize }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/stations', {
        params: {
          query: {
            search: params.search,
            page: params.page,
            pageSize: params.pageSize,
          },
        },
      });
      return data;
    },
    staleTime: 60 * 1000,
    enabled: (params.search?.length ?? 0) >= 2 || !params.search,
  });
}
