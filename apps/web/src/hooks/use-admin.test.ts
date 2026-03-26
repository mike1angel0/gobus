import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { useAdminBuses, useToggleSeat } from '@/hooks/use-admin';
import { ApiError } from '@/api/errors';

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, PATCH: mockPatch }),
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
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Seat disabled' }),
    );
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
