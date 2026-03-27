import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBusTracking } from './use-tracking';
import { ApiError } from '@/api/errors';

const mockGet = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const mockTrackingData = {
  id: 'trk_1',
  busId: 'bus_1',
  lat: 48.2082,
  lng: 16.3738,
  speed: 80,
  heading: 135,
  scheduleId: 'sched_1',
  currentStopIndex: 1,
  isActive: true,
  tripDate: '2026-04-01T08:00:00Z',
  updatedAt: '2026-04-01T09:30:00Z',
};

describe('useBusTracking', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches tracking data for a bus', async () => {
    mockGet.mockResolvedValue({ data: { data: mockTrackingData } });

    const { result } = renderHook(() => useBusTracking('bus_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toEqual(mockTrackingData);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/tracking/{busId}', {
      params: { path: { busId: 'bus_1' } },
    });
  });

  it('does not fetch when busId is empty', () => {
    const { result } = renderHook(() => useBusTracking(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(() => useBusTracking('bus_1', false), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('handles non-404 API errors after retries', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBusTracking('bus_1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Non-404 errors retry up to 3 times, so total calls = 4 (1 initial + 3 retries)
    expect(mockGet).toHaveBeenCalledTimes(4);
  });

  it('does not retry on 404 errors', async () => {
    const notFoundError = new ApiError({
      type: 'https://httpstatuses.com/404',
      title: 'Not Found',
      status: 404,
      detail: 'Bus tracking not found',
      code: 'TRACKING_NOT_FOUND',
    });
    mockGet.mockRejectedValue(notFoundError);

    // Use a wrapper that does NOT override retry, so the hook's custom retry logic is exercised
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0 } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBusTracking('bus_1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Custom retry returns false for 404, so only 1 call (no retries)
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
