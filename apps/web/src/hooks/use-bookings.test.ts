import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import {
  useBookings,
  useBookingDetail,
  useCreateBooking,
  useCancelBooking,
} from '@/hooks/use-bookings';
import { ApiError } from '@/api/errors';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, POST: mockPost, DELETE: mockDelete }),
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

const mockBookingListResponse = {
  data: [
    {
      id: 'bk_1',
      orderId: 'ord_1',
      userId: 'usr_1',
      scheduleId: 'sched_1',
      totalPrice: 25.0,
      status: 'CONFIRMED',
      boardingStop: 'Berlin',
      alightingStop: 'Prague',
      tripDate: '2026-04-01',
      seatLabels: ['1A'],
      createdAt: '2026-03-25T10:00:00Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockBookingDetailResponse = {
  data: {
    id: 'bk_1',
    orderId: 'ord_1',
    userId: 'usr_1',
    scheduleId: 'sched_1',
    totalPrice: 25.0,
    status: 'CONFIRMED',
    boardingStop: 'Berlin',
    alightingStop: 'Prague',
    tripDate: '2026-04-01',
    seatLabels: ['1A'],
    schedule: {
      departureTime: '2026-04-01T08:00:00Z',
      arrivalTime: '2026-04-01T12:00:00Z',
      route: { id: 'route_1', name: 'Berlin - Prague', provider: { id: 'prov_1', name: 'EuroBus' } },
      bus: { id: 'bus_1', licensePlate: 'AB-123', model: 'Mercedes Tourismo' },
    },
    createdAt: '2026-03-25T10:00:00Z',
  },
};

describe('useBookings', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated booking list', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBookingListResponse });

    const { result } = renderHook(() => useBookings({ page: 1, pageSize: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBookingListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings', {
      params: {
        query: { status: undefined, page: 1, pageSize: 20 },
      },
    });
  });

  it('passes status filter to the API', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBookingListResponse });

    const { result } = renderHook(() => useBookings({ status: 'CONFIRMED' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings', {
      params: {
        query: { status: 'CONFIRMED', page: undefined, pageSize: undefined },
      },
    });
  });

  it('fetches with default params when none provided', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBookingListResponse });

    const { result } = renderHook(() => useBookings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings', {
      params: {
        query: { status: undefined, page: undefined, pageSize: undefined },
      },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useBookings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(apiError);
  });
});

describe('useBookingDetail', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches booking details for a valid id', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBookingDetailResponse });

    const { result } = renderHook(() => useBookingDetail('bk_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBookingDetailResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/bookings/{id}', {
      params: { path: { id: 'bk_1' } },
    });
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useBookingDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Not found');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useBookingDetail('bk_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(apiError);
  });
});

describe('useCreateBooking', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockToast.mockReset();
  });

  it('creates a booking and shows success toast', async () => {
    mockPost.mockResolvedValueOnce({ data: mockBookingDetailResponse });

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        seatLabels: ['1A'],
        boardingStop: 'Berlin',
        alightingStop: 'Prague',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/api/v1/bookings', {
      body: {
        scheduleId: 'sched_1',
        seatLabels: ['1A'],
        boardingStop: 'Berlin',
        alightingStop: 'Prague',
        tripDate: '2026-04-01',
      },
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Booking confirmed' }),
    );
  });

  it('shows seat conflict message on 409 error', async () => {
    const conflictError = new ApiError({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Seats already booked',
    });
    mockPost.mockRejectedValueOnce(conflictError);

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        seatLabels: ['1A'],
        boardingStop: 'Berlin',
        alightingStop: 'Prague',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Seats already taken',
        variant: 'destructive',
      }),
    );
  });

  it('shows generic error message on non-409 API error', async () => {
    const badRequest = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid stop order',
    });
    mockPost.mockRejectedValueOnce(badRequest);

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        seatLabels: ['1A'],
        boardingStop: 'Berlin',
        alightingStop: 'Prague',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Booking failed',
        description: 'Invalid stop order',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message for unknown errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        seatLabels: ['1A'],
        boardingStop: 'Berlin',
        alightingStop: 'Prague',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Booking failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});

describe('useCancelBooking', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockToast.mockReset();
  });

  it('cancels a booking and shows success toast', async () => {
    mockDelete.mockResolvedValueOnce({ data: mockBookingDetailResponse });

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('bk_1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/bookings/{id}', {
      params: { path: { id: 'bk_1' } },
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Booking cancelled' }),
    );
  });

  it('shows error toast on cancellation failure', async () => {
    const badRequest = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Booking already cancelled',
    });
    mockDelete.mockRejectedValueOnce(badRequest);

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('bk_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cancellation failed',
        description: 'Booking already cancelled',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message for unknown errors', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('bk_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cancellation failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});
