import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApiClient } from '@/api/hooks';
import { apiClient } from '@/api/client';

describe('useApiClient', () => {
  it('returns the singleton apiClient instance', () => {
    const { result } = renderHook(() => useApiClient());
    expect(result.current).toBe(apiClient);
  });

  it('returns the same reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useApiClient());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
