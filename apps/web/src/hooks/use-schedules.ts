import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { scheduleKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';
import type { components } from '@/api/generated/types';

/** Filter and pagination parameters for the schedules list endpoint. */
export interface SchedulesParams {
  /** Filter by route ID. */
  routeId?: string;
  /** Filter by bus ID. */
  busId?: string;
  /** Filter by schedule status. */
  status?: components['schemas']['ScheduleStatus'];
  /** Filter schedules from this date (inclusive, ISO 8601). */
  fromDate?: string;
  /** Filter schedules until this date (inclusive, ISO 8601). */
  toDate?: string;
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
}

/** Request body for creating a schedule with stop times. */
export type CreateScheduleBody = components['schemas']['CreateScheduleRequest'];

/** Request body for updating a schedule. */
export type UpdateScheduleBody = components['schemas']['UpdateScheduleRequest'];

/**
 * React Query hook that fetches the authenticated provider's schedules (paginated, filtered).
 *
 * Calls `GET /api/v1/schedules` with optional route, bus, status, and date range filters.
 *
 * @param params - Optional filter and pagination parameters.
 * @returns A React Query result with the paginated schedule list.
 *
 * @example
 * ```tsx
 * const { data } = useSchedules({ routeId: 'route_1', status: 'ACTIVE', page: 1 });
 * ```
 */
export function useSchedules(params: SchedulesParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: scheduleKeys.lists({
      routeId: params.routeId,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/schedules', {
        params: {
          query: {
            routeId: params.routeId,
            busId: params.busId,
            status: params.status,
            fromDate: params.fromDate,
            toDate: params.toDate,
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
 * React Query hook that fetches a single schedule's details.
 *
 * Calls `GET /api/v1/schedules/{id}` using the typed API client.
 * The query is only enabled when `id` is a non-empty string.
 *
 * @param id - The schedule identifier.
 * @returns A React Query result with the schedule detail data including route, bus, driver, and stop times.
 *
 * @example
 * ```tsx
 * const { data } = useScheduleDetail('sched_abc123');
 * ```
 */
export function useScheduleDetail(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: scheduleKeys.detail(id),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/schedules/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    enabled: id.length > 0,
    staleTime: 60 * 1000,
  });
}

/**
 * React Query mutation hook that creates a new schedule with stop times.
 *
 * Calls `POST /api/v1/schedules`. On success, invalidates schedule list queries
 * and shows a success toast.
 *
 * @returns A React Query mutation result for creating schedules.
 *
 * @example
 * ```tsx
 * const createSchedule = useCreateSchedule();
 * createSchedule.mutate({ routeId: 'route_1', busId: 'bus_1', ... });
 * ```
 */
export function useCreateSchedule() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: CreateScheduleBody) => {
      const { data } = await client.POST('/api/v1/schedules', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast({
        title: 'Schedule created',
        description: 'The schedule has been created successfully.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to create schedule',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that updates a schedule.
 *
 * Calls `PUT /api/v1/schedules/{id}`. On success, invalidates schedule queries
 * and shows a success toast. Supports updating driver assignment, status, and times.
 *
 * @returns A React Query mutation result for updating schedules.
 *
 * @example
 * ```tsx
 * const updateSchedule = useUpdateSchedule();
 * updateSchedule.mutate({ id: 'sched_1', body: { driverId: 'driver_1' } });
 * ```
 */
export function useUpdateSchedule() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateScheduleBody }) => {
      const { data } = await client.PUT('/api/v1/schedules/{id}', {
        params: { path: { id } },
        body,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast({ title: 'Schedule updated', description: 'The schedule has been updated.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to update schedule',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that cancels a schedule.
 *
 * Calls `DELETE /api/v1/schedules/{id}`. On success, invalidates schedule queries
 * and shows a success toast. The caller is responsible for showing a
 * confirmation dialog before invoking the mutation.
 *
 * @returns A React Query mutation result for cancelling schedules.
 *
 * @example
 * ```tsx
 * const cancelSchedule = useCancelSchedule();
 * cancelSchedule.mutate('sched_abc123');
 * ```
 */
export function useCancelSchedule() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await client.DELETE('/api/v1/schedules/{id}', {
        params: { path: { id } },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast({ title: 'Schedule cancelled', description: 'The schedule has been cancelled.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to cancel schedule',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}
