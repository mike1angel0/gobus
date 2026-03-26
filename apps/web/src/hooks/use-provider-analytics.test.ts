import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useProviderAnalytics } from './use-provider-analytics';

/* ---------- Mocks ---------- */

const mockGet = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet }),
}));

/* ---------- Helpers ---------- */

const mockAnalyticsResponse = {
  data: {
    totalBookings: 142,
    totalRevenue: 15230.5,
    averageOccupancy: 0.73,
    revenueByRoute: [
      { routeId: 'r1', routeName: 'NYC - Boston', revenue: 8500 },
      { routeId: 'r2', routeName: 'NYC - DC', revenue: 6730.5 },
    ],
  },
};

/** Creates a fresh QueryClient wrapper for hook tests. */
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

/* ---------- Tests ---------- */

describe('useProviderAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches analytics from GET /api/v1/provider/analytics', async () => {
    mockGet.mockResolvedValueOnce({ data: mockAnalyticsResponse });

    const { result } = renderHook(() => useProviderAnalytics(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/provider/analytics');
    expect(result.current.data).toEqual(mockAnalyticsResponse);
  });

  it('returns error state when API call fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProviderAnalytics(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('returns loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useProviderAnalytics(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
