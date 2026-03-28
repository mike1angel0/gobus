import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageTitle } from '@/hooks/use-page-title';

describe('usePageTitle', () => {
  afterEach(() => {
    document.title = 'GoBus';
  });

  it('sets document.title to "Page | GoBus" on mount', () => {
    renderHook(() => usePageTitle('Search'));

    expect(document.title).toBe('Search | GoBus');
  });

  it('reverts document.title to "GoBus" on unmount', () => {
    const { unmount } = renderHook(() => usePageTitle('Search'));

    expect(document.title).toBe('Search | GoBus');

    unmount();

    expect(document.title).toBe('GoBus');
  });

  it('updates document.title when the title argument changes', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: 'Search' },
    });

    expect(document.title).toBe('Search | GoBus');

    rerender({ title: 'My Trips' });

    expect(document.title).toBe('My Trips | GoBus');
  });
});
