import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import {
  useDriverTrips,
  useDriverTripDetail,
  useDriverTripPassengers,
} from '@/hooks/use-driver-trips';

const mockGet = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet }),
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

const mockTripListResponse = {
  data: [
    {
      scheduleId: 'sched_1',
      departureTime: '2026-04-01T08:00:00Z',
      arrivalTime: '2026-04-01T12:00:00Z',
      tripDate: '2026-04-01T00:00:00Z',
      routeName: 'Bucharest - Cluj',
      busLicensePlate: 'B-123-ABC',
      status: 'ACTIVE',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockTripDetailResponse = {
  data: {
    scheduleId: 'sched_1',
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    tripDate: '2026-04-01T00:00:00Z',
    routeName: 'Bucharest - Cluj',
    busLicensePlate: 'B-123-ABC',
    busModel: 'Mercedes Tourismo',
    status: 'ACTIVE',
    stops: [
      {
        id: 'stop_1',
        stopName: 'Bucharest North',
        arrivalTime: '2026-04-01T08:00:00Z',
        departureTime: '2026-04-01T08:05:00Z',
        orderIndex: 0,
        priceFromStart: 0,
      },
    ],
    passengerCount: 25,
    totalSeats: 40,
  },
};

describe('useDriverTrips', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches driver trips with date filter', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTripListResponse });

    const { result } = renderHook(() => useDriverTrips({ date: '2026-04-01' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTripListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/driver/trips', {
      params: {
        query: {
          date: '2026-04-01',
          page: undefined,
          pageSize: undefined,
        },
      },
    });
  });

  it('fetches driver trips without date (defaults to today on server)', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTripListResponse });

    const { result } = renderHook(() => useDriverTrips(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/driver/trips', {
      params: {
        query: {
          date: undefined,
          page: undefined,
          pageSize: undefined,
        },
      },
    });
  });

  it('passes pagination params', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTripListResponse });

    const { result } = renderHook(
      () => useDriverTrips({ date: '2026-04-01', page: 2, pageSize: 10 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/driver/trips', {
      params: {
        query: {
          date: '2026-04-01',
          page: 2,
          pageSize: 10,
        },
      },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDriverTrips({ date: '2026-04-01' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useDriverTripDetail', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches trip detail by scheduleId', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTripDetailResponse });

    const { result } = renderHook(() => useDriverTripDetail('sched_1', '2026-04-01'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTripDetailResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/driver/trips/{scheduleId}', {
      params: {
        path: { scheduleId: 'sched_1' },
        query: { date: '2026-04-01' },
      },
    });
  });

  it('fetches trip detail without date', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTripDetailResponse });

    const { result } = renderHook(() => useDriverTripDetail('sched_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/driver/trips/{scheduleId}', {
      params: {
        path: { scheduleId: 'sched_1' },
        query: { date: undefined },
      },
    });
  });

  it('does not fetch when scheduleId is empty', () => {
    const { result } = renderHook(() => useDriverTripDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Not found');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDriverTripDetail('sched_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

const mockPassengersResponse = {
  data: [
    {
      bookingId: 'bk_1',
      passengerName: 'Alice Smith',
      boardingStop: 'Bucharest North',
      alightingStop: 'Cluj Central',
      seatLabels: ['1A', '1B'],
      status: 'CONFIRMED',
    },
    {
      bookingId: 'bk_2',
      passengerName: 'Bob Jones',
      boardingStop: 'Pitesti',
      alightingStop: 'Cluj Central',
      seatLabels: ['3C'],
      status: 'CANCELLED',
    },
  ],
};

describe('useDriverTripPassengers', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches passengers by scheduleId and date', async () => {
    mockGet.mockResolvedValueOnce({ data: mockPassengersResponse });

    const { result } = renderHook(
      () => useDriverTripPassengers('sched_1', '2026-04-01'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockPassengersResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/driver/trips/{scheduleId}/passengers', {
      params: {
        path: { scheduleId: 'sched_1' },
        query: { date: '2026-04-01' },
      },
    });
  });

  it('fetches passengers without date', async () => {
    mockGet.mockResolvedValueOnce({ data: mockPassengersResponse });

    const { result } = renderHook(() => useDriverTripPassengers('sched_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/driver/trips/{scheduleId}/passengers', {
      params: {
        path: { scheduleId: 'sched_1' },
        query: { date: undefined },
      },
    });
  });

  it('does not fetch when scheduleId is empty', () => {
    const { result } = renderHook(() => useDriverTripPassengers(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Forbidden');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDriverTripPassengers('sched_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});
