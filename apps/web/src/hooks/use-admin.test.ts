import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import {
  useAdminBuses,
  useToggleSeat,
  useAdminUsers,
  useUpdateUserStatus,
  useForceLogout,
  useAuditLogs,
} from '@/hooks/use-admin';
import { ApiError } from '@/api/errors';

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, PATCH: mockPatch, DELETE: mockDelete }),
}));

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const mockBusListResponse = {
  data: [
    {
      id: 'bus_1',
      licensePlate: 'AB-123',
      model: 'Mercedes Tourismo',
      capacity: 50,
      rows: 13,
      columns: 4,
      providerId: 'prov_1',
      createdAt: '2026-03-25T10:00:00Z',
    },
    {
      id: 'bus_2',
      licensePlate: 'CD-456',
      model: 'Volvo 9700',
      capacity: 45,
      rows: 12,
      columns: 4,
      providerId: 'prov_2',
      createdAt: '2026-03-24T10:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
};

const mockSeatResponse = {
  data: {
    id: 'seat_1',
    row: 0,
    column: 0,
    label: '1A',
    type: 'STANDARD',
    price: 0,
    isEnabled: false,
  },
};

describe('useAdminBuses', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated bus list across all providers', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBusListResponse });

    const { result } = renderHook(() => useAdminBuses({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBusListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/buses', {
      params: { query: { page: 1, pageSize: undefined, providerId: undefined } },
    });
  });

  it('passes providerId filter to the API', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBusListResponse });

    const { result } = renderHook(
      () => useAdminBuses({ page: 1, pageSize: 10, providerId: 'prov_1' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/buses', {
      params: { query: { page: 1, pageSize: 10, providerId: 'prov_1' } },
    });
  });

  it('fetches with default params when none provided', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBusListResponse });

    const { result } = renderHook(() => useAdminBuses(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/buses', {
      params: { query: { page: undefined, pageSize: undefined, providerId: undefined } },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useAdminBuses(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useToggleSeat', () => {
  beforeEach(() => {
    mockPatch.mockReset();
    mockToast.mockReset();
  });

  it('disables a seat and shows success toast', async () => {
    mockPatch.mockResolvedValueOnce({ data: mockSeatResponse });

    const { result } = renderHook(() => useToggleSeat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'seat_1', isEnabled: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPatch).toHaveBeenCalledWith('/api/v1/admin/seats/{id}', {
      params: { path: { id: 'seat_1' } },
      body: { isEnabled: false },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Seat disabled' }));
  });

  it('enables a seat and shows success toast', async () => {
    const enabledSeat = { data: { ...mockSeatResponse.data, isEnabled: true } };
    mockPatch.mockResolvedValueOnce({ data: enabledSeat });

    const { result } = renderHook(() => useToggleSeat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'seat_1', isEnabled: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Seat enabled',
        description: 'The seat is now available for booking.',
      }),
    );
  });

  it('shows detail from ApiError on toggle failure', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Seat not found',
    });
    mockPatch.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useToggleSeat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'seat_999', isEnabled: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update seat',
        description: 'Seat not found',
        variant: 'destructive',
      }),
    );
  });

  it('shows title fallback when ApiError has no detail', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
    });
    mockPatch.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useToggleSeat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'seat_1', isEnabled: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update seat',
        description: 'Forbidden',
        variant: 'destructive',
      }),
    );
  });

  it('shows generic message for non-ApiError failure', async () => {
    mockPatch.mockRejectedValueOnce(new Error('timeout'));

    const { result } = renderHook(() => useToggleSeat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'seat_1', isEnabled: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update seat',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});

const mockUserListResponse = {
  data: [
    {
      id: 'user_1',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'PASSENGER' as const,
      status: 'ACTIVE' as const,
      failedLoginAttempts: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user_2',
      email: 'bob@example.com',
      name: 'Bob',
      role: 'DRIVER' as const,
      status: 'SUSPENDED' as const,
      failedLoginAttempts: 3,
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
};

const mockUserDataResponse = {
  data: {
    id: 'user_1',
    email: 'alice@example.com',
    name: 'Alice',
    role: 'PASSENGER' as const,
    status: 'SUSPENDED' as const,
    failedLoginAttempts: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-26T00:00:00Z',
  },
};

describe('useAdminUsers', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated user list', async () => {
    mockGet.mockResolvedValueOnce({ data: mockUserListResponse });

    const { result } = renderHook(() => useAdminUsers({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockUserListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/users', {
      params: {
        query: { page: 1, pageSize: undefined, role: undefined, status: undefined },
      },
    });
  });

  it('passes role and status filters to the API', async () => {
    mockGet.mockResolvedValueOnce({ data: mockUserListResponse });

    const { result } = renderHook(
      () => useAdminUsers({ page: 1, role: 'DRIVER', status: 'SUSPENDED' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/users', {
      params: {
        query: { page: 1, pageSize: undefined, role: 'DRIVER', status: 'SUSPENDED' },
      },
    });
  });

  it('fetches with default params when none provided', async () => {
    mockGet.mockResolvedValueOnce({ data: mockUserListResponse });

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/users', {
      params: {
        query: {
          page: undefined,
          pageSize: undefined,
          role: undefined,
          status: undefined,
        },
      },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useUpdateUserStatus', () => {
  beforeEach(() => {
    mockPatch.mockReset();
    mockToast.mockReset();
  });

  it('suspends a user and shows success toast', async () => {
    mockPatch.mockResolvedValueOnce({ data: mockUserDataResponse });

    const { result } = renderHook(() => useUpdateUserStatus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_1', action: 'suspend' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPatch).toHaveBeenCalledWith('/api/v1/admin/users/{id}/status', {
      params: { path: { id: 'user_1' } },
      body: { action: 'suspend' },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'User suspended',
        description: 'The user account has been suspended.',
      }),
    );
  });

  it('unsuspends a user and shows success toast', async () => {
    mockPatch.mockResolvedValueOnce({ data: mockUserDataResponse });

    const { result } = renderHook(() => useUpdateUserStatus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_1', action: 'unsuspend' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'User unsuspended',
        description: 'The user account has been reactivated.',
      }),
    );
  });

  it('unlocks a user and shows success toast', async () => {
    mockPatch.mockResolvedValueOnce({ data: mockUserDataResponse });

    const { result } = renderHook(() => useUpdateUserStatus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_1', action: 'unlock' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'User unlocked',
        description: 'The user account has been unlocked.',
      }),
    );
  });

  it('shows detail from ApiError on failure', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'User not found',
    });
    mockPatch.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useUpdateUserStatus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_999', action: 'suspend' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update user status',
        description: 'User not found',
        variant: 'destructive',
      }),
    );
  });

  it('shows generic message for non-ApiError failure', async () => {
    mockPatch.mockRejectedValueOnce(new Error('timeout'));

    const { result } = renderHook(() => useUpdateUserStatus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_1', action: 'suspend' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update user status',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});

describe('useForceLogout', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockToast.mockReset();
  });

  it('force-logs-out a user and shows success toast', async () => {
    mockDelete.mockResolvedValueOnce({});

    const { result } = renderHook(() => useForceLogout(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/admin/users/{id}/sessions', {
      params: { path: { id: 'user_1' } },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'User logged out',
        description: 'All sessions have been revoked.',
      }),
    );
  });

  it('shows detail from ApiError on failure', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'User not found',
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useForceLogout(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_999' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to force logout',
        description: 'User not found',
        variant: 'destructive',
      }),
    );
  });

  it('shows generic message for non-ApiError failure', async () => {
    mockDelete.mockRejectedValueOnce(new Error('timeout'));

    const { result } = renderHook(() => useForceLogout(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'user_1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to force logout',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});

const mockAuditLogListResponse = {
  data: [
    {
      id: 'log_1',
      userId: 'user_1',
      action: 'login',
      resource: 'session',
      resourceId: 'sess_1',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      metadata: null,
      createdAt: '2026-03-26T10:00:00Z',
    },
    {
      id: 'log_2',
      userId: 'user_2',
      action: 'update_status',
      resource: 'user',
      resourceId: 'user_3',
      ipAddress: '10.0.0.1',
      userAgent: null,
      metadata: null,
      createdAt: '2026-03-26T09:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
};

describe('useAuditLogs', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated audit logs', async () => {
    mockGet.mockResolvedValueOnce({ data: mockAuditLogListResponse });

    const { result } = renderHook(() => useAuditLogs({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockAuditLogListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/audit-logs', {
      params: {
        query: {
          page: 1,
          pageSize: undefined,
          userId: undefined,
          action: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
      },
    });
  });

  it('passes all filters to the API', async () => {
    mockGet.mockResolvedValueOnce({ data: mockAuditLogListResponse });

    const { result } = renderHook(
      () =>
        useAuditLogs({
          page: 1,
          pageSize: 10,
          userId: 'user_1',
          action: 'login',
          dateFrom: '2026-03-01T00:00:00Z',
          dateTo: '2026-03-31T23:59:59Z',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/audit-logs', {
      params: {
        query: {
          page: 1,
          pageSize: 10,
          userId: 'user_1',
          action: 'login',
          dateFrom: '2026-03-01T00:00:00Z',
          dateTo: '2026-03-31T23:59:59Z',
        },
      },
    });
  });

  it('fetches with default params when none provided', async () => {
    mockGet.mockResolvedValueOnce({ data: mockAuditLogListResponse });

    const { result } = renderHook(() => useAuditLogs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/audit-logs', {
      params: {
        query: {
          page: undefined,
          pageSize: undefined,
          userId: undefined,
          action: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
      },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useAuditLogs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});
