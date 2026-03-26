import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { searchKeys } from '@/api/keys';

/**
 * Search query parameters for the trip search endpoint.
 */
export interface SearchTripsParams {
  /** Origin stop name (min 2 characters). */
  origin: string;
  /** Destination stop name (min 2 characters). */
  destination: string;
  /** Trip date in ISO 8601 format (YYYY-MM-DD). */
  date: string;
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page (max 50). */
  pageSize?: number;
}

/**
 * Trip detail query parameters.
 */
export interface TripDetailsParams {
  /** Schedule identifier. */
  scheduleId: string;
  /** Trip date in ISO 8601 format (YYYY-MM-DD). */
  date: string;
}

/**
 * React Query hook that searches for available trips between two stops on a given date.
 *
 * Calls `GET /api/v1/search` using the typed API client. The query is only enabled
 * when both `origin` and `destination` are at least 2 characters and `date` is provided.
 *
 * @param params - Search parameters (origin, destination, date, optional pagination).
 * @returns A React Query result with search results, loading, and error states.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSearchTrips({
 *   origin: 'Berlin',
 *   destination: 'Prague',
 *   date: '2026-04-01',
 * });
 * ```
 */
export function useSearchTrips(params: SearchTripsParams) {
  const client = useApiClient();

  const hasRequiredParams =
    params.origin.length >= 2 && params.destination.length >= 2 && params.date.length > 0;

  return useQuery({
    queryKey: searchKeys.lists({
      from: params.origin,
      to: params.destination,
      date: params.date,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/search', {
        params: {
          query: {
            origin: params.origin,
            destination: params.destination,
            date: params.date,
            page: params.page,
            pageSize: params.pageSize,
          },
        },
      });
      return data;
    },
    enabled: hasRequiredParams,
    staleTime: 30 * 1000,
  });
}

/**
 * React Query hook that fetches detailed trip information including seat availability.
 *
 * Calls `GET /api/v1/trips/{scheduleId}?tripDate=` using the typed API client.
 * The query is only enabled when both `scheduleId` and `date` are provided.
 *
 * @param params - Trip detail parameters (scheduleId and date).
 * @returns A React Query result with trip detail data, loading, and error states.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTripDetails({
 *   scheduleId: 'sched_abc123',
 *   date: '2026-04-01',
 * });
 * ```
 */
export function useTripDetails(params: TripDetailsParams) {
  const client = useApiClient();

  const hasRequiredParams = params.scheduleId.length > 0 && params.date.length > 0;

  return useQuery({
    queryKey: searchKeys.detail(params.scheduleId),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/trips/{scheduleId}', {
        params: {
          path: { scheduleId: params.scheduleId },
          query: { tripDate: params.date },
        },
      });
      return data;
    },
    enabled: hasRequiredParams,
    staleTime: 10 * 1000,
  });
}
