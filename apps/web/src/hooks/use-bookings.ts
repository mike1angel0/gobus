import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { bookingKeys, searchKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';
import type { components } from '@/api/generated/types';

/** Filter / pagination parameters for the bookings list endpoint. */
export interface BookingsParams {
  /** Filter by booking status. */
  status?: components['schemas']['BookingStatus'];
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
}

/** Request body for creating a booking. */
export type CreateBookingBody = components['schemas']['CreateBookingRequest'];

/**
 * React Query hook that fetches the authenticated user's bookings (paginated).
 *
 * Calls `GET /api/v1/bookings` using the typed API client.
 *
 * @param params - Optional status filter and pagination parameters.
 * @returns A React Query result with the paginated booking list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useBookings({ status: 'CONFIRMED', page: 1 });
 * ```
 */
export function useBookings(params: BookingsParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: bookingKeys.lists({
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/bookings', {
        params: {
          query: {
            status: params.status,
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
 * React Query hook that fetches a single booking's details.
 *
 * Calls `GET /api/v1/bookings/{id}` using the typed API client.
 * The query is only enabled when `id` is a non-empty string.
 *
 * @param id - The booking identifier.
 * @returns A React Query result with the booking detail data.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useBookingDetail('bk_abc123');
 * ```
 */
export function useBookingDetail(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/bookings/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    enabled: id.length > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * React Query mutation hook that creates a new booking.
 *
 * Calls `POST /api/v1/bookings`. On success, invalidates both booking list
 * queries and trip detail queries (seat availability changes). Shows toast
 * notifications on success and error. Surfaces a specific message for 409
 * seat conflict errors.
 *
 * @returns A React Query mutation result for creating bookings.
 *
 * @example
 * ```tsx
 * const createBooking = useCreateBooking();
 * createBooking.mutate({
 *   scheduleId: 'sched_1',
 *   seatLabels: ['1A', '1B'],
 *   boardingStop: 'Berlin',
 *   alightingStop: 'Prague',
 *   tripDate: '2026-04-01',
 * });
 * ```
 */
export function useCreateBooking() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: CreateBookingBody) => {
      const { data } = await client.POST('/api/v1/bookings', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: searchKeys.all });
      toast({ title: 'Booking confirmed', description: 'Your booking has been created.' });
    },
    onError: (error: unknown) => {
      if (isApiError(error) && error.status === 409) {
        toast({
          title: 'Seats already taken',
          description:
            'One or more selected seats were booked by another passenger. Please refresh and try again.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Booking failed',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that cancels an existing booking.
 *
 * Calls `DELETE /api/v1/bookings/{id}`. On success, invalidates booking
 * queries. Shows toast notifications on success and error. The caller is
 * responsible for showing a confirmation dialog before invoking the mutation.
 *
 * @returns A React Query mutation result for cancelling bookings.
 *
 * @example
 * ```tsx
 * const cancelBooking = useCancelBooking();
 * cancelBooking.mutate('bk_abc123');
 * ```
 */
export function useCancelBooking() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await client.DELETE('/api/v1/bookings/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      toast({ title: 'Booking cancelled', description: 'Your booking has been cancelled.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Cancellation failed',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}
