import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { useDrivers, useCreateDriver, useDeleteDriver } from '@/hooks/use-drivers';
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

const mockDriverListResponse = {
  data: [
    {
      id: 'driver_1',
      email: 'john@example.com',
      name: 'John Doe',
      role: 'DRIVER',
      phone: '+49123456789',
      status: 'ACTIVE',
      providerId: 'prov_1',
      assignedScheduleCount: 3,
      createdAt: '2026-03-25T10:00:00Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
};

const mockDriverResponse = {
  data: {
    id: 'driver_1',
    email: 'john@example.com',
    name: 'John Doe',
    role: 'DRIVER',
    phone: '+49123456789',
    status: 'ACTIVE',
    providerId: 'prov_1',
    assignedScheduleCount: 3,
    createdAt: '2026-03-25T10:00:00Z',
  },
};

describe('useDrivers', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches paginated driver list', async () => {
    mockGet.mockResolvedValueOnce({ data: mockDriverListResponse });

    const { result } = renderHook(() => useDrivers({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockDriverListResponse);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/drivers', {
      params: { query: { page: 1, pageSize: undefined } },
    });
  });

  it('surfaces errors from the API', async () => {
    const apiError = new Error('Network error');
    mockGet.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDrivers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(apiError);
  });
});

describe('useCreateDriver', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockToast.mockReset();
  });

  it('creates a driver and shows success toast', async () => {
    mockPost.mockResolvedValueOnce({ data: mockDriverResponse });

    const { result } = renderHook(() => useCreateDriver(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/api/v1/drivers', {
      body: { name: 'John Doe', email: 'john@example.com', password: 'SecurePass1' },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Driver created' }));
  });

  it('shows email conflict message on 409 error', async () => {
    const conflictError = new ApiError({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Email already exists',
    });
    mockPost.mockRejectedValueOnce(conflictError);

    const { result } = renderHook(() => useCreateDriver(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass1',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Email already in use',
        variant: 'destructive',
      }),
    );
  });

  it('shows generic error for non-409 API errors', async () => {
    const badRequest = new ApiError({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid password format',
    });
    mockPost.mockRejectedValueOnce(badRequest);

    const { result } = renderHook(() => useCreateDriver(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        name: 'John',
        email: 'john@example.com',
        password: 'weak',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create driver',
        description: 'Invalid password format',
        variant: 'destructive',
      }),
    );
  });

  it('shows fallback message for unknown errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useCreateDriver(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        name: 'John',
        email: 'john@example.com',
        password: 'SecurePass1',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to create driver',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      }),
    );
  });
});

describe('useDeleteDriver', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockToast.mockReset();
  });

  it('deletes a driver and shows success toast', async () => {
    mockDelete.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useDeleteDriver(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('driver_1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/drivers/{id}', {
      params: { path: { id: 'driver_1' } },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Driver deleted' }));
  });

  it('shows error toast on deletion failure', async () => {
    const notFound = new ApiError({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Driver not found',
    });
    mockDelete.mockRejectedValueOnce(notFound);

    const { result } = renderHook(() => useDeleteDriver(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('driver_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to delete driver',
        description: 'Driver not found',
        variant: 'destructive',
      }),
    );
  });
});
