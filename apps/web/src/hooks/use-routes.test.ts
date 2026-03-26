import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { useRoutes, useRouteDetail, useCreateRoute, useDeleteRoute } from '@/hooks/use-routes';
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

const mockRouteListResponse = {
  data: [
    {
      id: 'route_1',
      name: 'Berlin - Prague',
      providerId: 'prov_1',
      createdAt: '2026-03-25T10:00:00Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockRouteDetailResponse = {
  data: {
    id: 'route_1',
    name: 'Berlin - Prague',
    providerId: 'prov_1',
    stops: [
      { id: 'stop_1', name: 'Berlin', lat: 52.52, lng: 13.405, orderIndex: 0 },
      { id: 'stop_2', name: 'Prague', lat: 50.075, lng: 14.437, orderIndex: 1 },
    ],
    createdAt: '2026-03-25T10:00:00Z',
  },
};

describe('useRoutes', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated route list', async () => {
    mockGet.mockResolvedValueOnce({ data: mockRouteListResponse });

    const { result } = renderHook(() => useRoutes({ page: 1, pageSize: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockRouteListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/routes', {
      params: { query: { page: 1, pageSize: 20 } },
    });
  });

  it('fetches with default params when none provided', async () => {
    mockGet.mockResolvedValueOnce({ data: mockRouteListResponse });

    const { result } = renderHook(() => useRoutes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/routes', {
      params: { query: { page: undefined, pageSize: undefined } },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useRoutes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useRouteDetail', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches route details for a valid id', async () => {
    mockGet.mockResolvedValueOnce({ data: mockRouteDetailResponse });

    const { result } = renderHook(() => useRouteDetail('route_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockRouteDetailResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/routes/{id}', {
      params: { path: { id: 'route_1' } },
    });
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useRouteDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('useCreateRoute', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockToast.mockReset();
  });

  it('creates a route and shows success toast', async () => {
    mockPost.mockResolvedValueOnce({ data: mockRouteDetailResponse });

    const { result } = renderHook(() => useCreateRoute(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        name: 'Berlin - Prague',
        stops: [
          { name: 'Berlin', lat: 52.52, lng: 13.405, orderIndex: 0 },
          { name: 'Prague', lat: 50.075, lng: 14.437, orderIndex: 1 },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/api/v1/routes', {
      body: {
        name: 'Berlin - Prague',
        stops: [
          { name: 'Berlin', lat: 52.52, lng: 13.405, orderIndex: 0 },
          { name: 'Prague', lat: 50.075, lng: 14.437, orderIndex: 1 },
        ],
      },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Route created' }));
  });

  it('shows error toast on API error', async () => {
    const badRequest = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'At least 2 stops required',
    });
    mockPost.mockRejectedValueOnce(badRequest);

    const { result } = renderHook(() => useCreateRoute(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        name: 'Test',
        stops: [{ name: 'Berlin', lat: 52.52, lng: 13.405, orderIndex: 0 }],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create route',
        description: 'At least 2 stops required',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message for unknown errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCreateRoute(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        name: 'Test',
        stops: [
          { name: 'A', lat: 0, lng: 0, orderIndex: 0 },
          { name: 'B', lat: 1, lng: 1, orderIndex: 1 },
        ],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create route',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});

describe('useDeleteRoute', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockToast.mockReset();
  });

  it('deletes a route and shows success toast', async () => {
    mockDelete.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useDeleteRoute(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('route_1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/routes/{id}', {
      params: { path: { id: 'route_1' } },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Route deleted' }));
  });

  it('shows error toast on deletion failure', async () => {
    const notFound = new ApiError({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Route not found',
    });
    mockDelete.mockRejectedValueOnce(notFound);

    const { result } = renderHook(() => useDeleteRoute(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('route_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to delete route',
        description: 'Route not found',
        variant: 'destructive',
      }),
    );
  });
});
