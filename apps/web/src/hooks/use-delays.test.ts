import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { useDelays, useCreateDelay, useUpdateDelay } from '@/hooks/use-delays';
import { ApiError } from '@/api/errors';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, POST: mockPost, PUT: mockPut }),
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

const mockDelayListResponse = {
  data: [
    {
      id: 'delay_1',
      scheduleId: 'sched_1',
      offsetMinutes: 15,
      reason: 'TRAFFIC',
      note: 'Heavy traffic on highway',
      tripDate: '2026-04-01T00:00:00Z',
      active: true,
      createdAt: '2026-04-01T10:00:00Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockDelayResponse = {
  data: {
    id: 'delay_1',
    scheduleId: 'sched_1',
    offsetMinutes: 15,
    reason: 'TRAFFIC',
    note: 'Heavy traffic on highway',
    tripDate: '2026-04-01T00:00:00Z',
    active: true,
    createdAt: '2026-04-01T10:00:00Z',
  },
};

describe('useDelays', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches delays for a schedule and trip date', async () => {
    mockGet.mockResolvedValueOnce({ data: mockDelayListResponse });

    const { result } = renderHook(
      () => useDelays({ scheduleId: 'sched_1', tripDate: '2026-04-01' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockDelayListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/delays', {
      params: {
        query: {
          scheduleId: 'sched_1',
          tripDate: '2026-04-01',
          page: undefined,
          pageSize: undefined,
        },
      },
    });
  });

  it('does not fetch when scheduleId is empty', () => {
    const { result } = renderHook(() => useDelays({ scheduleId: '', tripDate: '2026-04-01' }), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fetch when tripDate is empty', () => {
    const { result } = renderHook(() => useDelays({ scheduleId: 'sched_1', tripDate: '' }), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(
      () => useDelays({ scheduleId: 'sched_1', tripDate: '2026-04-01' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useCreateDelay', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockToast.mockReset();
  });

  it('creates a delay and shows success toast', async () => {
    mockPost.mockResolvedValueOnce({ data: mockDelayResponse });

    const { result } = renderHook(() => useCreateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        offsetMinutes: 15,
        reason: 'TRAFFIC',
        note: 'Heavy traffic',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/api/v1/delays', {
      body: {
        scheduleId: 'sched_1',
        offsetMinutes: 15,
        reason: 'TRAFFIC',
        note: 'Heavy traffic',
        tripDate: '2026-04-01',
      },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delay reported' }));
  });

  it('shows error toast on creation failure', async () => {
    const forbidden = new ApiError({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Not authorized to report delays for this schedule',
    });
    mockPost.mockRejectedValueOnce(forbidden);

    const { result } = renderHook(() => useCreateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        offsetMinutes: 15,
        reason: 'TRAFFIC',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to report delay',
        description: 'Not authorized to report delays for this schedule',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message for unknown errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCreateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        offsetMinutes: 15,
        reason: 'TRAFFIC',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to report delay',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });

  it('falls back to title when API error has no detail', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Unprocessable Entity',
      status: 422,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        scheduleId: 'sched_1',
        offsetMinutes: 15,
        reason: 'TRAFFIC',
        tripDate: '2026-04-01',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to report delay',
        description: 'Unprocessable Entity',
        variant: 'destructive',
      }),
    );
  });
});

describe('useUpdateDelay', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockToast.mockReset();
  });

  it('updates a delay and shows success toast', async () => {
    mockPut.mockResolvedValueOnce({
      data: { ...mockDelayResponse, data: { ...mockDelayResponse.data, active: false } },
    });

    const { result } = renderHook(() => useUpdateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'delay_1', body: { active: false } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/api/v1/delays/{id}', {
      params: { path: { id: 'delay_1' } },
      body: { active: false },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delay updated' }));
  });

  it('shows error toast on update failure with API error', async () => {
    const badRequest = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid offset minutes',
    });
    mockPut.mockRejectedValueOnce(badRequest);

    const { result } = renderHook(() => useUpdateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'delay_1', body: { offsetMinutes: -5 } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update delay',
        description: 'Invalid offset minutes',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message on update failure with non-API error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useUpdateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'delay_1', body: { offsetMinutes: 10 } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update delay',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });

  it('falls back to title when API error has no detail', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
    mockPut.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useUpdateDelay(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'delay_1', body: { offsetMinutes: 10 } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update delay',
        description: 'Internal Server Error',
        variant: 'destructive',
      }),
    );
  });
});
