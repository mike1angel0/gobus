import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBusTracking } from './use-tracking';

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

  it('handles API errors gracefully', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBusTracking('bus_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
