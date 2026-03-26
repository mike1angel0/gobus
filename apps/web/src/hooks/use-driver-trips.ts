import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { driverTripKeys } from '@/api/keys';

/** Parameters for fetching the authenticated driver's trips. */
export interface DriverTripsParams {
  /** Trip date in ISO 8601 format (YYYY-MM-DD). Defaults to today on the server. */
  date?: string;
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
}

/**
 * React Query hook that fetches the authenticated driver's assigned trips for a date.
 *
 * Calls `GET /api/v1/driver/trips` with an optional `date` query param.
 * Requires the DRIVER role.
 *
 * @param params - Optional date and pagination filters.
 * @returns A React Query result with the driver trip list and pagination meta.
 *
 * @example
 * ```tsx
 * const { data } = useDriverTrips({ date: '2026-04-01' });
 * const trips = data?.data ?? [];
 * ```
 */
export function useDriverTrips(params: DriverTripsParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: driverTripKeys.lists({
      date: params.date,
      page: params.page,
      pageSize: params.pageSize,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/driver/trips', {
        params: {
          query: {
            date: params.date,
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
 * React Query hook that fetches detailed information about a single driver trip.
 *
 * Calls `GET /api/v1/driver/trips/{scheduleId}` with an optional `date` query param.
 * Includes route stops, passenger count, and bus information.
 * Requires the DRIVER role and the schedule must be assigned to the authenticated driver.
 *
 * @param scheduleId - The schedule identifier to fetch details for.
 * @param date - Optional trip date in ISO 8601 format (YYYY-MM-DD). Defaults to today on the server.
 * @returns A React Query result with the driver trip detail.
 *
 * @example
 * ```tsx
 * const { data } = useDriverTripDetail('sched_abc', '2026-04-01');
 * const trip = data?.data;
 * ```
 */
export function useDriverTripDetail(scheduleId: string, date?: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: driverTripKeys.detail(scheduleId),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/driver/trips/{scheduleId}', {
        params: {
          path: { scheduleId },
          query: { date },
        },
      });
      return data;
    },
    enabled: scheduleId.length > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * React Query hook that fetches the passenger manifest for a driver's trip.
 *
 * Calls `GET /api/v1/driver/trips/{scheduleId}/passengers` with an optional
 * `date` query param. Returns the list of confirmed/cancelled bookings with
 * passenger name, boarding/alighting stops, and seat labels.
 * Requires the DRIVER role.
 *
 * @param scheduleId - The schedule identifier.
 * @param date - Optional trip date in ISO 8601 format (YYYY-MM-DD). Defaults to today on the server.
 * @returns A React Query result with the passenger list.
 *
 * @example
 * ```tsx
 * const { data } = useDriverTripPassengers('sched_abc', '2026-04-01');
 * const passengers = data?.data ?? [];
 * ```
 */
export function useDriverTripPassengers(scheduleId: string, date?: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: driverTripKeys.passengers(scheduleId, date),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/driver/trips/{scheduleId}/passengers', {
        params: {
          path: { scheduleId },
          query: { date },
        },
      });
      return data;
    },
    enabled: scheduleId.length > 0,
    staleTime: 30 * 1000,
  });
}
