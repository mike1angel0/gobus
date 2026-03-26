import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import {
  useSchedules,
  useScheduleDetail,
  useCreateSchedule,
  useUpdateSchedule,
  useCancelSchedule,
} from '@/hooks/use-schedules';
import { ApiError } from '@/api/errors';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, POST: mockPost, PUT: mockPut, DELETE: mockDelete }),
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

const mockScheduleListResponse = {
  data: [
    {
      id: 'sched_1',
      routeId: 'route_1',
      busId: 'bus_1',
      driverId: 'driver_1',
      departureTime: '2026-04-01T08:00:00Z',
      arrivalTime: '2026-04-01T12:00:00Z',
      daysOfWeek: [1, 2, 3, 4, 5],
      basePrice: 25.0,
      status: 'ACTIVE',
      tripDate: '2026-04-01T00:00:00Z',
      createdAt: '2026-03-25T10:00:00Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockScheduleDetailResponse = {
  data: {
    id: 'sched_1',
    routeId: 'route_1',
    busId: 'bus_1',
    driverId: 'driver_1',
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    daysOfWeek: [1, 2, 3, 4, 5],
    basePrice: 25.0,
    status: 'ACTIVE',
    tripDate: '2026-04-01T00:00:00Z',
    stopTimes: [],
    route: { id: 'route_1', name: 'Berlin - Prague', providerId: 'prov_1', createdAt: '2026-03-25T10:00:00Z' },
    bus: { id: 'bus_1', licensePlate: 'AB-123', model: 'Mercedes', capacity: 50, rows: 13, columns: 4, providerId: 'prov_1', createdAt: '2026-03-25T10:00:00Z' },
    driver: { id: 'driver_1', name: 'John Doe' },
    createdAt: '2026-03-25T10:00:00Z',
  },
};

describe('useSchedules', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated schedule list with filters', async () => {
    mockGet.mockResolvedValueOnce({ data: mockScheduleListResponse });

    const { result } = renderHook(
      () => useSchedules({ routeId: 'route_1', status: 'ACTIVE', page: 1 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockScheduleListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/schedules', {
      params: {
        query: {
          routeId: 'route_1',
          busId: undefined,
          status: 'ACTIVE',
          fromDate: undefined,
          toDate: undefined,
          page: 1,
          pageSize: undefined,
        },
      },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useSchedules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useScheduleDetail', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches schedule details for a valid id', async () => {
    mockGet.mockResolvedValueOnce({ data: mockScheduleDetailResponse });

    const { result } = renderHook(() => useScheduleDetail('sched_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockScheduleDetailResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/schedules/{id}', {
      params: { path: { id: 'sched_1' } },
    });
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useScheduleDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('useCreateSchedule', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockToast.mockReset();
  });

  it('creates a schedule and shows success toast', async () => {
    mockPost.mockResolvedValueOnce({ data: mockScheduleDetailResponse });

    const { result } = renderHook(() => useCreateSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        routeId: 'route_1',
        busId: 'bus_1',
        departureTime: '2026-04-01T08:00:00Z',
        arrivalTime: '2026-04-01T12:00:00Z',
        basePrice: 25.0,
        tripDate: '2026-04-01T00:00:00Z',
        stopTimes: [
          { stopName: 'Berlin', arrivalTime: '2026-04-01T08:00:00Z', departureTime: '2026-04-01T08:00:00Z', orderIndex: 0, priceFromStart: 0 },
          { stopName: 'Prague', arrivalTime: '2026-04-01T12:00:00Z', departureTime: '2026-04-01T12:00:00Z', orderIndex: 1, priceFromStart: 25 },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Schedule created' }));
  });

  it('shows error toast on failure', async () => {
    const badRequest = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Route not found',
    });
    mockPost.mockRejectedValueOnce(badRequest);

    const { result } = renderHook(() => useCreateSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        routeId: 'invalid',
        busId: 'bus_1',
        departureTime: '2026-04-01T08:00:00Z',
        arrivalTime: '2026-04-01T12:00:00Z',
        basePrice: 25.0,
        tripDate: '2026-04-01T00:00:00Z',
        stopTimes: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create schedule',
        description: 'Route not found',
        variant: 'destructive',
      }),
    );
  });
});

describe('useUpdateSchedule', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockToast.mockReset();
  });

  it('updates a schedule and shows success toast', async () => {
    mockPut.mockResolvedValueOnce({ data: mockScheduleDetailResponse });

    const { result } = renderHook(() => useUpdateSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'sched_1', body: { driverId: 'driver_2' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/api/v1/schedules/{id}', {
      params: { path: { id: 'sched_1' } },
      body: { driverId: 'driver_2' },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Schedule updated' }));
  });

  it('shows error toast on update failure', async () => {
    mockPut.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useUpdateSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'sched_1', body: { driverId: 'driver_2' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update schedule',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});

describe('useCancelSchedule', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockToast.mockReset();
  });

  it('cancels a schedule and shows success toast', async () => {
    mockDelete.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useCancelSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('sched_1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/schedules/{id}', {
      params: { path: { id: 'sched_1' } },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Schedule cancelled' }),
    );
  });

  it('shows error toast on cancellation failure', async () => {
    const notFound = new ApiError({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Schedule not found',
    });
    mockDelete.mockRejectedValueOnce(notFound);

    const { result } = renderHook(() => useCancelSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('sched_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to cancel schedule',
        description: 'Schedule not found',
        variant: 'destructive',
      }),
    );
  });
});
