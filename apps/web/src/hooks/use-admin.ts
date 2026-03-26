import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '@/api/generated/types';
import { useApiClient } from '@/api/hooks';
import { adminKeys, busKeys } from '@/api/keys';
import { isApiError } from '@/api/errors';
import { useToast } from '@/hooks/use-toast';

/** User status action type from the OpenAPI spec. */
type UserStatusAction = components['schemas']['AdminUpdateUserStatusRequest']['action'];

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

/** Pagination and filter parameters for the admin users list endpoint. */
export interface AdminUsersParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** Filter by user role. */
  role?: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  /** Filter by user account status. */
  status?: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
}

/**
 * React Query hook that fetches all platform users with optional filters (admin only).
 *
 * Calls `GET /api/v1/admin/users` using the typed API client.
 * Requires ADMIN role. Results are paginated and optionally filtered by role and status.
 *
 * @param params - Optional pagination and filter parameters.
 * @returns A React Query result with the paginated user list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAdminUsers({ page: 1, role: 'DRIVER' });
 * ```
 */
export function useAdminUsers(params: AdminUsersParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: adminKeys.users({
      page: params.page,
      pageSize: params.pageSize,
      role: params.role,
      status: params.status,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/admin/users', {
        params: {
          query: {
            page: params.page,
            pageSize: params.pageSize,
            role: params.role,
            status: params.status,
          },
        },
      });
      return data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * React Query mutation hook that updates a user's account status (admin only).
 *
 * Calls `PATCH /api/v1/admin/users/{id}/status` with the desired action.
 * On success, invalidates admin user queries so the list refreshes.
 * Shows a toast on success or failure.
 *
 * @returns A React Query mutation result for updating user status.
 *
 * @example
 * ```tsx
 * const updateStatus = useUpdateUserStatus();
 * updateStatus.mutate({ id: 'user_abc', action: 'suspend' });
 * ```
 */
export function useUpdateUserStatus() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: UserStatusAction }) => {
      const { data } = await client.PATCH('/api/v1/admin/users/{id}/status', {
        params: { path: { id } },
        body: { action },
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(variables.id) });
      const actionLabels: Record<UserStatusAction, string> = {
        suspend: 'User suspended',
        unsuspend: 'User unsuspended',
        unlock: 'User unlocked',
      };
      const descriptionLabels: Record<UserStatusAction, string> = {
        suspend: 'The user account has been suspended.',
        unsuspend: 'The user account has been reactivated.',
        unlock: 'The user account has been unlocked.',
      };
      toast({
        title: actionLabels[variables.action],
        description: descriptionLabels[variables.action],
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to update user status',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * React Query mutation hook that force-logs-out a user by revoking all sessions (admin only).
 *
 * Calls `DELETE /api/v1/admin/users/{id}/sessions`.
 * On success, invalidates admin user queries.
 * Shows a toast on success or failure.
 *
 * @returns A React Query mutation result for force logout.
 *
 * @example
 * ```tsx
 * const forceLogout = useForceLogout();
 * forceLogout.mutate({ id: 'user_abc' });
 * ```
 */
export function useForceLogout() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await client.DELETE('/api/v1/admin/users/{id}/sessions', {
        params: { path: { id } },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.userSessions(variables.id) });
      toast({
        title: 'User logged out',
        description: 'All sessions have been revoked.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to force logout',
        description: isApiError(error)
          ? (error.detail ?? error.title)
          : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

/** Pagination and filter parameters for the admin audit logs endpoint. */
export interface AuditLogsParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** Filter by user ID. */
  userId?: string;
  /** Filter by action type. */
  action?: string;
  /** Filter by date range start (ISO 8601). */
  dateFrom?: string;
  /** Filter by date range end (ISO 8601). */
  dateTo?: string;
}

/**
 * React Query hook that fetches audit log entries with optional filters (admin only).
 *
 * Calls `GET /api/v1/admin/audit-logs` using the typed API client.
 * Requires ADMIN role. Results are paginated and optionally filtered by userId,
 * action, and date range.
 *
 * @param params - Optional pagination and filter parameters.
 * @returns A React Query result with the paginated audit log list.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAuditLogs({ page: 1, action: 'login' });
 * ```
 */
export function useAuditLogs(params: AuditLogsParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: adminKeys.auditLogs({
      page: params.page,
      pageSize: params.pageSize,
      userId: params.userId,
      action: params.action,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/admin/audit-logs', {
        params: {
          query: {
            page: params.page,
            pageSize: params.pageSize,
            userId: params.userId,
            action: params.action,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          },
        },
      });
      return data;
    },
    staleTime: 60 * 1000,
  });
}
