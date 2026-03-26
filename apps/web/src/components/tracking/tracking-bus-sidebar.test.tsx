import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import { TrackingBusSidebar } from './tracking-bus-sidebar';
import { renderWithProviders } from '@/test/helpers';
import type { TrackedBus } from './tracking-bus-sidebar';

/* ---------- Helpers ---------- */

function makeBus(overrides: Partial<TrackedBus['bus']> = {}): TrackedBus['bus'] {
  return {
    id: 'bus-1',
    licensePlate: 'AB-123',
    model: 'Volvo 9700',
    capacity: 50,
    rows: 10,
    columns: 4,
    providerId: 'provider-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTracking(
  overrides: Partial<NonNullable<TrackedBus['tracking']>> = {},
): TrackedBus['tracking'] {
  return {
    id: 'tracking-1',
    busId: 'bus-1',
    lat: 48.2,
    lng: 16.3,
    speed: 65.4,
    heading: 90,
    isActive: true,
    currentStopIndex: 2,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/* ---------- Tests ---------- */

describe('TrackingBusSidebar', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('renders loading skeleton', () => {
    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={[]}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={true}
      />,
    );

    expect(screen.getByLabelText('Loading bus list')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading bus list')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders empty state when no buses', () => {
    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={[]}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByText('No buses in your fleet')).toBeInTheDocument();
  });

  it('renders bus card with tracking data', () => {
    const trackedBuses: TrackedBus[] = [
      { bus: makeBus(), tracking: makeTracking({ speed: 65.4, currentStopIndex: 2 }) },
    ];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByText('AB-123')).toBeInTheDocument();
    expect(screen.getByText('Volvo 9700')).toBeInTheDocument();
    expect(screen.getByText('65 km/h')).toBeInTheDocument();
    expect(screen.getByText('Stop 3')).toBeInTheDocument();
  });

  it('renders "No tracking data" when tracking is null', () => {
    const trackedBuses: TrackedBus[] = [{ bus: makeBus(), tracking: null }];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByText('No tracking data')).toBeInTheDocument();
  });

  it('shows green active indicator when tracking.isActive is true', () => {
    const trackedBuses: TrackedBus[] = [
      { bus: makeBus(), tracking: makeTracking({ isActive: true }) },
    ];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByLabelText('Active')).toBeInTheDocument();
  });

  it('does not show active indicator when tracking.isActive is false', () => {
    const trackedBuses: TrackedBus[] = [
      { bus: makeBus(), tracking: makeTracking({ isActive: false }) },
    ];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.queryByLabelText('Active')).not.toBeInTheDocument();
  });

  it('highlights selected bus with aria-pressed', () => {
    const trackedBuses: TrackedBus[] = [
      { bus: makeBus({ id: 'bus-1' }), tracking: null },
      { bus: makeBus({ id: 'bus-2', licensePlate: 'CD-456' }), tracking: null },
    ];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId="bus-1"
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByLabelText('Select bus AB-123')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Select bus CD-456')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelectBus when bus is clicked', async () => {
    const onSelectBus = vi.fn();
    const trackedBuses: TrackedBus[] = [{ bus: makeBus({ id: 'bus-42' }), tracking: null }];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={onSelectBus}
        isLoading={false}
      />,
    );

    await userEvent.click(screen.getByLabelText('Select bus AB-123'));
    expect(onSelectBus).toHaveBeenCalledWith('bus-42');
  });

  it('renders multiple buses in a list', () => {
    const trackedBuses: TrackedBus[] = [
      { bus: makeBus({ id: 'bus-1', licensePlate: 'AB-123' }), tracking: null },
      { bus: makeBus({ id: 'bus-2', licensePlate: 'CD-456' }), tracking: null },
      { bus: makeBus({ id: 'bus-3', licensePlate: 'EF-789' }), tracking: null },
    ];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByRole('list', { name: 'Bus tracking list' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('has aria-live region for real-time updates', () => {
    const trackedBuses: TrackedBus[] = [{ bus: makeBus(), tracking: makeTracking() }];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    const list = screen.getByRole('list', { name: 'Bus tracking list' });
    expect(list).toHaveAttribute('aria-live', 'polite');
  });

  it('shows relative time for updatedAt', () => {
    const trackedBuses: TrackedBus[] = [
      { bus: makeBus(), tracking: makeTracking({ updatedAt: new Date().toISOString() }) },
    ];

    renderWithProviders(
      <TrackingBusSidebar
        trackedBuses={trackedBuses}
        selectedBusId={null}
        onSelectBus={vi.fn()}
        isLoading={false}
      />,
    );

    // "less than a minute ago" or similar
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });
});
