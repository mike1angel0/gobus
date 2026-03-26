import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import {
  useBuses,
  useBusDetail,
  useCreateBus,
  useUpdateBus,
  useDeleteBus,
  useBusTemplates,
} from '@/hooks/use-buses';
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

const mockBusListResponse = {
  data: [
    {
      id: 'bus_1',
      licensePlate: 'AB-123',
      model: 'Mercedes Tourismo',
      capacity: 50,
      rows: 13,
      columns: 4,
      providerId: 'prov_1',
      createdAt: '2026-03-25T10:00:00Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockBusDetailResponse = {
  data: {
    id: 'bus_1',
    licensePlate: 'AB-123',
    model: 'Mercedes Tourismo',
    capacity: 50,
    rows: 13,
    columns: 4,
    providerId: 'prov_1',
    seats: [
      { id: 'seat_1', row: 0, column: 0, label: '1A', type: 'STANDARD', price: 0, isEnabled: true },
    ],
    createdAt: '2026-03-25T10:00:00Z',
  },
};

const mockTemplatesResponse = {
  data: [{ id: 'tmpl_1', name: 'Standard 50-seat', rows: 13, columns: 4, capacity: 50, seats: [] }],
};

describe('useBuses', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated bus list', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBusListResponse });

    const { result } = renderHook(() => useBuses({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBusListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/buses', {
      params: { query: { page: 1, pageSize: undefined } },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useBuses(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useBusDetail', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches bus details for a valid id', async () => {
    mockGet.mockResolvedValueOnce({ data: mockBusDetailResponse });

    const { result } = renderHook(() => useBusDetail('bus_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBusDetailResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/buses/{id}', {
      params: { path: { id: 'bus_1' } },
    });
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useBusDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('useCreateBus', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockToast.mockReset();
  });

  it('creates a bus and shows success toast', async () => {
    mockPost.mockResolvedValueOnce({ data: mockBusDetailResponse });

    const { result } = renderHook(() => useCreateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        licensePlate: 'AB-123',
        model: 'Mercedes Tourismo',
        capacity: 50,
        rows: 13,
        columns: 4,
        seats: [{ row: 0, column: 0, label: '1A', type: 'STANDARD', price: 0 }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bus created' }));
  });

  it('shows license plate conflict message on 409 error', async () => {
    const conflictError = new ApiError({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'License plate already exists',
    });
    mockPost.mockRejectedValueOnce(conflictError);

    const { result } = renderHook(() => useCreateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        licensePlate: 'AB-123',
        model: 'Mercedes',
        capacity: 50,
        rows: 13,
        columns: 4,
        seats: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'License plate conflict',
        variant: 'destructive',
      }),
    );
  });

  it('shows generic error for non-409 API errors', async () => {
    const badRequest = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid seat layout',
    });
    mockPost.mockRejectedValueOnce(badRequest);

    const { result } = renderHook(() => useCreateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        licensePlate: 'AB-123',
        model: 'Mercedes',
        capacity: 50,
        rows: 13,
        columns: 4,
        seats: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create bus',
        description: 'Invalid seat layout',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message for non-API errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCreateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        licensePlate: 'AB-123',
        model: 'Mercedes',
        capacity: 50,
        rows: 13,
        columns: 4,
        seats: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create bus',
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

    const { result } = renderHook(() => useCreateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        licensePlate: 'AB-123',
        model: 'Mercedes',
        capacity: 50,
        rows: 13,
        columns: 4,
        seats: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create bus',
        description: 'Unprocessable Entity',
        variant: 'destructive',
      }),
    );
  });
});

describe('useUpdateBus', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockToast.mockReset();
  });

  it('updates a bus and shows success toast', async () => {
    mockPut.mockResolvedValueOnce({ data: mockBusDetailResponse });

    const { result } = renderHook(() => useUpdateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'bus_1', body: { model: 'Volvo 9700' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/api/v1/buses/{id}', {
      params: { path: { id: 'bus_1' } },
      body: { model: 'Volvo 9700' },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bus updated' }));
  });

  it('shows error toast on update failure with non-API error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useUpdateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'bus_1', body: { model: 'Volvo' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update bus',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });

  it('shows API error detail on update failure', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid model name',
    });
    mockPut.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useUpdateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'bus_1', body: { model: '' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update bus',
        description: 'Invalid model name',
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

    const { result } = renderHook(() => useUpdateBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ id: 'bus_1', body: { model: 'Volvo' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to update bus',
        description: 'Internal Server Error',
        variant: 'destructive',
      }),
    );
  });
});

describe('useDeleteBus', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockToast.mockReset();
  });

  it('deletes a bus and shows success toast', async () => {
    mockDelete.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useDeleteBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('bus_1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/buses/{id}', {
      params: { path: { id: 'bus_1' } },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bus deleted' }));
  });

  it('shows API error detail on deletion failure', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Bus is assigned to active schedules',
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('bus_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to delete bus',
        description: 'Bus is assigned to active schedules',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message on deletion failure with non-API error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useDeleteBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('bus_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to delete bus',
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
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteBus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('bus_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to delete bus',
        description: 'Internal Server Error',
        variant: 'destructive',
      }),
    );
  });
});

describe('useBusTemplates', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches bus templates', async () => {
    mockGet.mockResolvedValueOnce({ data: mockTemplatesResponse });

    const { result } = renderHook(() => useBusTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTemplatesResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/buses/templates');
  });
});
