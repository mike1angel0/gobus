import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { delayKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';
import type { components } from '@/api/generated/types';

/** Parameters for fetching delays (required: scheduleId and tripDate). */
export interface DelaysParams {
  /** Schedule to get delays for. */
  scheduleId: string;
  /** Trip date (ISO 8601 date). */
  tripDate: string;
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
}

/** Request body for reporting a delay. */
export type CreateDelayBody = components['schemas']['CreateDelayRequest'];

/** Request body for updating a delay. */
export type UpdateDelayBody = components['schemas']['UpdateDelayRequest'];

/**
 * React Query hook that fetches delays for a specific schedule and trip date.
 *
 * Calls `GET /api/v1/delays` with required `scheduleId` and `tripDate` query params.
 * The query is only enabled when both `scheduleId` and `tripDate` are non-empty.
 *
 * @param params - The schedule ID, trip date, and optional pagination.
 * @returns A React Query result with the delay list.
 *
 * @example
 * ```tsx
 * const { data } = useDelays({ scheduleId: 'sched_1', tripDate: '2026-04-01' });
 * ```
 */
export function useDelays(params: DelaysParams) {
  const client = useApiClient();

  return useQuery({
    queryKey: delayKeys.lists({
      scheduleId: params.scheduleId,
      page: params.page,
      pageSize: params.pageSize,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/delays', {
        params: {
          query: {
            scheduleId: params.scheduleId,
            tripDate: params.tripDate,
            page: params.page,
            pageSize: params.pageSize,
          },
        },
      });
      return data;
    },
    enabled: params.scheduleId.length > 0 && params.tripDate.length > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * React Query mutation hook that reports a new delay.
 *
 * Calls `POST /api/v1/delays`. On success, invalidates delay queries
 * and shows a success toast. Requires DRIVER or PROVIDER role.
 *
 * @returns A React Query mutation result for creating delays.
 *
 * @example
 * ```tsx
 * const createDelay = useCreateDelay();
 * createDelay.mutate({ scheduleId: 'sched_1', offsetMinutes: 15, reason: 'TRAFFIC', tripDate: '2026-04-01' });
 * ```
 */
export function useCreateDelay() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (body: CreateDelayBody) => {
      const { data } = await client.POST('/api/v1/delays', { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: delayKeys.all });
      toast({ title: 'Delay reported', description: 'The delay has been reported successfully.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to report delay',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that updates an existing delay.
 *
 * Calls `PUT /api/v1/delays/{id}`. On success, invalidates delay queries
 * and shows a success toast. Supports updating offset, reason, note, and active status.
 *
 * @returns A React Query mutation result for updating delays.
 *
 * @example
 * ```tsx
 * const updateDelay = useUpdateDelay();
 * updateDelay.mutate({ id: 'delay_1', body: { active: false } });
 * ```
 */
export function useUpdateDelay() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateDelayBody }) => {
      const { data } = await client.PUT('/api/v1/delays/{id}', {
        params: { path: { id } },
        body,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: delayKeys.all });
      toast({ title: 'Delay updated', description: 'The delay has been updated.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to update delay',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}
