import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageTitle } from '@/hooks/use-page-title';

describe('usePageTitle', () => {
  afterEach(() => {
    document.title = 'Transio';
  });

  it('sets document.title to "Page | Transio" on mount', () => {
    renderHook(() => usePageTitle('Search'));

    expect(document.title).toBe('Search | Transio');
  });

  it('reverts document.title to "Transio" on unmount', () => {
    const { unmount } = renderHook(() => usePageTitle('Search'));

    expect(document.title).toBe('Search | Transio');

    unmount();

    expect(document.title).toBe('Transio');
  });

  it('updates document.title when the title argument changes', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: 'Search' },
    });

    expect(document.title).toBe('Search | Transio');

    rerender({ title: 'My Trips' });

    expect(document.title).toBe('My Trips | Transio');
  });
});
