import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import { CardGridSkeleton, CardListSkeleton } from './loading-skeleton';

describe('CardGridSkeleton', () => {
  it('renders default 6 skeleton cards', () => {
    const { container } = renderWithProviders(<CardGridSkeleton label="Loading fleet" />);
    const cards = container.querySelectorAll('[class*="animate-pulse"]');
    // Each card has 4 skeleton lines, so 6 cards × 4 = 24 skeleton elements
    expect(cards.length).toBe(24);
  });

  it('renders custom count of skeleton cards', () => {
    const { container } = renderWithProviders(<CardGridSkeleton label="Loading items" count={3} />);
    const cards = container.querySelectorAll('[class*="animate-pulse"]');
    expect(cards.length).toBe(12); // 3 cards × 4 skeleton lines
  });

  it('sets aria-busy and aria-label', () => {
    renderWithProviders(<CardGridSkeleton label="Loading fleet" />);
    const grid = screen.getByLabelText('Loading fleet');
    expect(grid).toHaveAttribute('aria-busy', 'true');
  });

  it('uses responsive grid layout', () => {
    renderWithProviders(<CardGridSkeleton label="Loading" />);
    const grid = screen.getByLabelText('Loading');
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('sm:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-3');
  });
});

describe('CardListSkeleton', () => {
  it('renders default 3 skeleton items', () => {
    const { container } = renderWithProviders(<CardListSkeleton label="Loading bookings" />);
    // Each list item has 5 skeleton elements
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBe(15); // 3 items × 5 skeleton lines
  });

  it('renders custom count of skeleton items', () => {
    const { container } = renderWithProviders(<CardListSkeleton label="Loading trips" count={5} />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBe(25); // 5 items × 5 skeleton lines
  });

  it('sets aria-busy and aria-label', () => {
    renderWithProviders(<CardListSkeleton label="Loading bookings" />);
    const list = screen.getByLabelText('Loading bookings');
    expect(list).toHaveAttribute('aria-busy', 'true');
  });

  it('uses vertical list layout', () => {
    renderWithProviders(<CardListSkeleton label="Loading" />);
    const list = screen.getByLabelText('Loading');
    expect(list.className).toContain('space-y-4');
  });
});
