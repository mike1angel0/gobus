import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { useUpdateTracking, useProviderTracking } from '@/hooks/use-provider-tracking';
import { ApiError } from '@/api/errors';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, POST: mockPost }),
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

const mockTrackingResponse = {
  data: {
    id: 'trk_1',
    busId: 'bus_1',
    lat: 52.52,
    lng: 13.405,
    speed: 60,
    heading: 90,
    scheduleId: 'sched_1',
    currentStopIndex: 2,
    isActive: true,
    tripDate: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T10:30:00Z',
  },
};

describe('useUpdateTracking', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockToast.mockReset();
  });

  it('updates tracking position successfully', async () => {
    mockPost.mockResolvedValueOnce({ data: mockTrackingResponse });

    const { result } = renderHook(() => useUpdateTracking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        busId: 'bus_1',
        lat: 52.52,
        lng: 13.405,
        speed: 60,
        heading: 90,
        currentStopIndex: 2,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/api/v1/tracking', {
      body: {
        busId: 'bus_1',
        lat: 52.52,
        lng: 13.405,
        speed: 60,
        heading: 90,
        currentStopIndex: 2,
      },
    });
  });

  it('shows error toast on tracking update failure', async () => {
    const forbidden = new ApiError({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Not assigned to this bus',
    });
    mockPost.mockRejectedValueOnce(forbidden);

    const { result } = renderHook(() => useUpdateTracking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        busId: 'bus_1',
        lat: 52.52,
        lng: 13.405,
        speed: 60,
        heading: 90,
        currentStopIndex: 0,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tracking update failed',
        description: 'Not assigned to this bus',
        variant: 'destructive',
      }),
    );
  });
});

describe('useProviderTracking', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches tracking for multiple buses', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTrackingResponse }).mockResolvedValueOnce({
      data: { ...mockTrackingResponse, data: { ...mockTrackingResponse.data, busId: 'bus_2' } },
    });

    const { result } = renderHook(() => useProviderTracking(['bus_1', 'bus_2']), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/tracking/{busId}', {
      params: { path: { busId: 'bus_1' } },
    });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/tracking/{busId}', {
      params: { path: { busId: 'bus_2' } },
    });
  });

  it('does not fetch when busIds array is empty', () => {
    const { result } = renderHook(() => useProviderTracking([]), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useProviderTracking(['bus_1'], false), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('filters out failed tracking requests', async () => {
    mockGet
      .mockResolvedValueOnce({ data: mockTrackingResponse })
      .mockRejectedValueOnce(new Error('Bus not found'));

    const { result } = renderHook(() => useProviderTracking(['bus_1', 'bus_missing']), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
  });
});
