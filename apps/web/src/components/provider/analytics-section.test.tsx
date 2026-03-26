import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { AnalyticsSection } from './analytics-section';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Helpers ---------- */

const mockAnalytics = {
  totalBookings: 142,
  totalRevenue: 15230.5,
  averageOccupancy: 0.73,
  revenueByRoute: [
    { routeId: 'r1', routeName: 'NYC - Boston', revenue: 8500 },
    { routeId: 'r2', routeName: 'NYC - DC', revenue: 6730.5 },
  ],
};

/* ---------- Tests ---------- */

describe('AnalyticsSection', () => {
  describe('loaded state', () => {
    it('renders total bookings', () => {
      renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByText('142')).toBeInTheDocument();
      expect(screen.getByText('Total bookings')).toBeInTheDocument();
    });

    it('renders total revenue formatted as currency', () => {
      renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByText('$15,230.50')).toBeInTheDocument();
      expect(screen.getByText('Total revenue')).toBeInTheDocument();
    });

    it('renders average occupancy as percentage', () => {
      renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByText('73.0%')).toBeInTheDocument();
      expect(screen.getByText('Avg. occupancy')).toBeInTheDocument();
    });

    it('renders revenue-by-route breakdown', () => {
      renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByText('NYC - Boston')).toBeInTheDocument();
      expect(screen.getByText('$8,500.00')).toBeInTheDocument();
      expect(screen.getByText('NYC - DC')).toBeInTheDocument();
      expect(screen.getByText('$6,730.50')).toBeInTheDocument();
    });

    it('renders revenue bars with correct aria attributes', () => {
      renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      const meters = screen.getAllByRole('meter');
      expect(meters).toHaveLength(2);

      const bostonBar = screen.getByRole('meter', { name: 'NYC - Boston revenue' });
      expect(bostonBar).toHaveAttribute('aria-valuenow', '8500');
      expect(bostonBar).toHaveAttribute('aria-valuemin', '0');
      expect(bostonBar).toHaveAttribute('aria-valuemax', '8500');
    });
  });

  describe('empty revenue-by-route', () => {
    it('renders empty state when revenueByRoute is empty', () => {
      const emptyAnalytics = { ...mockAnalytics, revenueByRoute: [] };
      renderWithProviders(
        <AnalyticsSection data={emptyAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByText('No revenue data yet')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      renderWithProviders(
        <AnalyticsSection data={undefined} isLoading={true} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByLabelText('Loading analytics')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByLabelText('Loading revenue by route')).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });
  });

  describe('error state', () => {
    it('renders error state with retry button', () => {
      renderWithProviders(
        <AnalyticsSection data={undefined} isLoading={false} isError={true} onRetry={vi.fn()} />,
      );

      expect(screen.getByText('Analytics unavailable')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      renderWithProviders(
        <AnalyticsSection data={undefined} isLoading={false} isError={true} onRetry={onRetry} />,
      );

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has proper heading for analytics section', () => {
      renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const { container } = renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('has section with aria-labelledby', () => {
      renderWithProviders(
        <AnalyticsSection data={mockAnalytics} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByLabelText('Analytics')).toBeInTheDocument();
    });
  });

  describe('default values', () => {
    it('renders zero values when data is undefined but not loading', () => {
      renderWithProviders(
        <AnalyticsSection data={undefined} isLoading={false} isError={false} onRetry={vi.fn()} />,
      );

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });
});
