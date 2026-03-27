import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useCities, useSearchTrips, useTripDetails } from '@/hooks/use-search';

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

const mockSearchResponse = {
  data: [
    {
      scheduleId: 'sched_1',
      providerName: 'EuroBus',
      routeName: 'Berlin - Prague',
      origin: 'Berlin',
      destination: 'Prague',
      departureTime: '2026-04-01T08:00:00Z',
      arrivalTime: '2026-04-01T12:00:00Z',
      tripDate: '2026-04-01',
      price: 25.0,
      availableSeats: 30,
      totalSeats: 40,
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockTripDetailResponse = {
  data: {
    scheduleId: 'sched_1',
    routeName: 'Berlin - Prague',
    providerName: 'EuroBus',
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    tripDate: '2026-04-01',
    basePrice: 50.0,
    status: 'ACTIVE',
    stopTimes: [
      {
        id: 'st_1',
        stopName: 'Berlin',
        arrivalTime: '2026-04-01T08:00:00Z',
        departureTime: '2026-04-01T08:00:00Z',
        orderIndex: 0,
        priceFromStart: 0,
      },
      {
        id: 'st_2',
        stopName: 'Prague',
        arrivalTime: '2026-04-01T12:00:00Z',
        departureTime: '2026-04-01T12:00:00Z',
        orderIndex: 1,
        priceFromStart: 25.0,
      },
    ],
    seats: [
      {
        id: 'seat_1',
        row: 1,
        column: 1,
        label: '1A',
        type: 'STANDARD',
        price: 0,
        isEnabled: true,
        isBooked: false,
      },
    ],
  },
};

describe('useSearchTrips', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches search results when params are valid', async () => {
    mockGet.mockResolvedValueOnce({ data: mockSearchResponse });

    const { result } = renderHook(
      () =>
        useSearchTrips({
          origin: 'Berlin',
          destination: 'Prague',
          date: '2026-04-01',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSearchResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/search', {
      params: {
        query: {
          origin: 'Berlin',
          destination: 'Prague',
          date: '2026-04-01',
          page: undefined,
          pageSize: undefined,
        },
      },
    });
  });

  it('passes pagination params to the API', async () => {
    mockGet.mockResolvedValueOnce({ data: mockSearchResponse });

    const { result } = renderHook(
      () =>
        useSearchTrips({
          origin: 'Berlin',
          destination: 'Prague',
          date: '2026-04-01',
          page: 2,
          pageSize: 10,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/search', {
      params: {
        query: {
          origin: 'Berlin',
          destination: 'Prague',
          date: '2026-04-01',
          page: 2,
          pageSize: 10,
        },
      },
    });
  });

  it('does not fetch when origin is too short', () => {
    const { result } = renderHook(
      () =>
        useSearchTrips({
          origin: 'B',
          destination: 'Prague',
          date: '2026-04-01',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fetch when destination is too short', () => {
    const { result } = renderHook(
      () =>
        useSearchTrips({
          origin: 'Berlin',
          destination: 'P',
          date: '2026-04-01',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fetch when date is empty', () => {
    const { result } = renderHook(
      () =>
        useSearchTrips({
          origin: 'Berlin',
          destination: 'Prague',
          date: '',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces errors from the API client', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(
      () =>
        useSearchTrips({
          origin: 'Berlin',
          destination: 'Prague',
          date: '2026-04-01',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(apiError);
  });
});

describe('useTripDetails', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches trip details when params are valid', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTripDetailResponse });

    const { result } = renderHook(
      () =>
        useTripDetails({
          scheduleId: 'sched_1',
          date: '2026-04-01',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTripDetailResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/trips/{scheduleId}', {
      params: {
        path: { scheduleId: 'sched_1' },
        query: { tripDate: '2026-04-01' },
      },
    });
  });

  it('does not fetch when scheduleId is empty', () => {
    const { result } = renderHook(
      () =>
        useTripDetails({
          scheduleId: '',
          date: '2026-04-01',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fetch when date is empty', () => {
    const { result } = renderHook(
      () =>
        useTripDetails({
          scheduleId: 'sched_1',
          date: '',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces errors from the API client', async () => {
    const apiError = new Error('Not found');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(
      () =>
        useTripDetails({
          scheduleId: 'sched_1',
          date: '2026-04-01',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(apiError);
  });
});

describe('useCities', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches and returns cities list', async () => {
    const mockCitiesResponse = {
      data: ['Alba Iulia', 'Brașov', 'București', 'Cluj-Napoca'],
    };
    mockGet.mockResolvedValue({ data: mockCitiesResponse });

    const { result } = renderHook(() => useCities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockCitiesResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/cities');
  });

  it('handles API errors gracefully', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValue(apiError);

    const { result } = renderHook(() => useCities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(apiError);
  });
});
