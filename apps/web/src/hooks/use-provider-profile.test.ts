import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { useProviderProfile } from '@/hooks/use-provider-profile';

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

const mockProviderResponse = {
  data: {
    id: 'prov_1',
    name: 'Fast Bus Co',
    logo: 'https://example.com/logo.png',
    contactEmail: 'contact@fastbus.com',
    contactPhone: '+40700123456',
    status: 'APPROVED',
    createdAt: '2024-06-15T10:00:00Z',
    updatedAt: '2024-09-01T12:00:00Z',
  },
};

describe('useProviderProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches provider profile from GET /api/v1/providers/me', async () => {
    mockGet.mockResolvedValueOnce({ data: mockProviderResponse });

    const { result } = renderHook(() => useProviderProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/providers/me');
    expect(result.current.data).toEqual(mockProviderResponse);
  });

  it('returns error state when API call fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProviderProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
