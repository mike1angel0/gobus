import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProviderTrackingPage from './tracking';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockBuses = vi.fn();
const mockProviderTracking = vi.fn();
const mockSchedules = vi.fn();
const mockDelays = vi.fn();
const mockCreateDelay = vi.fn();
const mockUpdateDelay = vi.fn();

vi.mock('@/hooks/use-buses', () => ({
  useBuses: (...args: unknown[]) => mockBuses(...args),
}));

vi.mock('@/hooks/use-provider-tracking', () => ({
  useProviderTracking: (...args: unknown[]) => mockProviderTracking(...args),
}));

vi.mock('@/hooks/use-schedules', () => ({
  useSchedules: (...args: unknown[]) => mockSchedules(...args),
}));

vi.mock('@/hooks/use-delays', () => ({
  useDelays: (...args: unknown[]) => mockDelays(...args),
  useCreateDelay: () => mockCreateDelay(),
  useUpdateDelay: () => mockUpdateDelay(),
}));

vi.mock('@/components/maps/live-map', () => ({
  LiveMap: ({ stops, busPosition, className }: {
    stops: Array<{ name: string; lat: number; lng: number }>;
    busPosition?: { lat: number; lng: number; heading: number };
    className?: string;
  }) => (
    <div data-testid="live-map" className={className} role="region" aria-label="Live route map">
      <span data-testid="map-stops">{stops.length} stops</span>
      {busPosition && (
        <span data-testid="map-bus-position">
          {busPosition.lat},{busPosition.lng}
        </span>
      )}
    </div>
  ),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded state for useBuses. */
function busesLoaded(buses: unknown[] = []) {
  return {
    data: { data: buses, meta: { total: buses.length, page: 1, pageSize: 100, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns a loading state. */
function loadingState() {
  return { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
}

/** Returns an error state. */
function errorState() {
  return { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
}

/** Returns a loaded tracking state. */
function trackingLoaded(data: unknown[] = []) {
  return { data, isLoading: false, isError: false, refetch: vi.fn() };
}

/** Returns a loaded schedules state. */
function schedulesLoaded(schedules: unknown[] = []) {
  return {
    data: { data: schedules, meta: { total: schedules.length, page: 1, pageSize: 100, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns a loaded delays state. */
function delaysLoaded(delays: unknown[] = []) {
  return {
    data: { data: delays, meta: { total: delays.length, page: 1, pageSize: 50, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Creates a mock bus. */
function createMockBus(id: string, plate: string, model = 'Mercedes Tourismo') {
  return {
    id,
    licensePlate: plate,
    model,
    capacity: 50,
    rows: 10,
    columns: 5,
    providerId: 'prov_1',
    createdAt: '2026-03-20T10:00:00Z',
  };
}

/** Creates a mock tracking record. */
function createMockTracking(busId: string, overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: `track_${busId}`,
      busId,
      lat: 48.2,
      lng: 16.37,
      speed: 65,
      heading: 90,
      scheduleId: 'sched_1',
      currentStopIndex: 2,
      isActive: true,
      tripDate: '2026-03-26T00:00:00Z',
      updatedAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

/** Creates a mock schedule. */
function createMockSchedule(id: string) {
  return {
    id,
    routeId: 'route_1',
    busId: 'bus_1',
    driverId: null,
    departureTime: '2026-03-26T08:00:00Z',
    arrivalTime: '2026-03-26T12:00:00Z',
    daysOfWeek: [1, 2, 3, 4, 5],
    basePrice: 25,
    status: 'ACTIVE',
    tripDate: '2026-03-26T08:00:00Z',
    createdAt: '2026-03-20T10:00:00Z',
  };
}

/** Creates a mock delay. */
function createMockDelay(id: string, active = true) {
  return {
    id,
    scheduleId: 'sched_1',
    offsetMinutes: 15,
    reason: 'TRAFFIC',
    note: 'Heavy traffic on highway',
    tripDate: '2026-03-26T00:00:00Z',
    active,
    createdAt: '2026-03-26T08:30:00Z',
  };
}

/** Returns a default mutation result. */
function idleMutation() {
  return { mutate: vi.fn(), isPending: false };
}

/** Sets up all mocks with default loaded state. */
function setupDefaults(buses: unknown[] = [], tracking: unknown[] = []) {
  mockBuses.mockReturnValue(busesLoaded(buses));
  mockProviderTracking.mockReturnValue(trackingLoaded(tracking));
  mockSchedules.mockReturnValue(schedulesLoaded([]));
  mockDelays.mockReturnValue(delaysLoaded([]));
  mockCreateDelay.mockReturnValue(idleMutation());
  mockUpdateDelay.mockReturnValue(idleMutation());
}

/* ---------- Tests ---------- */

describe('ProviderTrackingPage', () => {
  beforeEach(() => {
    mockBuses.mockReset();
    mockProviderTracking.mockReset();
    mockSchedules.mockReset();
    mockDelays.mockReset();
    mockCreateDelay.mockReset();
    mockUpdateDelay.mockReset();
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockBuses.mockReturnValue(loadingState());
      mockProviderTracking.mockReturnValue(trackingLoaded([]));
      mockSchedules.mockReturnValue(schedulesLoaded([]));
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByLabelText('Loading tracking')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('error state', () => {
    it('renders error state when bus query fails', () => {
      mockBuses.mockReturnValue(errorState());
      mockProviderTracking.mockReturnValue(trackingLoaded([]));
      mockSchedules.mockReturnValue(schedulesLoaded([]));
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load tracking data')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockBuses.mockReturnValue({ ...errorState(), refetch });
      mockProviderTracking.mockReturnValue({ ...trackingLoaded([]), refetch: vi.fn() });
      mockSchedules.mockReturnValue({ ...schedulesLoaded([]), refetch: vi.fn() });
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('loaded state with no buses', () => {
    it('renders empty bus list message', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByText('No buses in your fleet')).toBeInTheDocument();
    });

    it('renders the live map', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByTestId('live-map')).toBeInTheDocument();
    });
  });

  describe('loaded state with buses', () => {
    it('renders bus cards in the sidebar', () => {
      const buses = [
        createMockBus('bus_1', 'AB-123', 'Mercedes Tourismo'),
        createMockBus('bus_2', 'CD-456', 'Volvo 9700'),
      ];
      setupDefaults(buses, []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByText('AB-123')).toBeInTheDocument();
      expect(screen.getByText('CD-456')).toBeInTheDocument();
      expect(screen.getByText('Mercedes Tourismo')).toBeInTheDocument();
      expect(screen.getByText('Volvo 9700')).toBeInTheDocument();
    });

    it('shows tracking data for active buses', () => {
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1', { speed: 65, currentStopIndex: 2 })];
      setupDefaults(buses, tracking);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByText('65 km/h')).toBeInTheDocument();
      expect(screen.getByText('Stop 3')).toBeInTheDocument();
    });

    it('shows "No tracking data" for buses without tracking', () => {
      const buses = [createMockBus('bus_1', 'AB-123')];
      setupDefaults(buses, []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByText('No tracking data')).toBeInTheDocument();
    });

    it('renders active bus positions on the map', () => {
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1', { lat: 48.2, lng: 16.37 })];
      setupDefaults(buses, tracking);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByTestId('map-stops')).toHaveTextContent('1 stops');
    });
  });

  describe('bus selection', () => {
    it('selects a bus when clicked', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1')];
      setupDefaults(buses, tracking);

      renderWithProviders(<ProviderTrackingPage />);

      const selectButton = screen.getByRole('button', { name: 'Select bus AB-123' });
      expect(selectButton).toHaveAttribute('aria-pressed', 'false');

      await user.click(selectButton);

      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows focused bus position on map when selected', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1', { lat: 48.2, lng: 16.37 })];
      setupDefaults(buses, tracking);

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: 'Select bus AB-123' }));

      expect(screen.getByTestId('map-bus-position')).toHaveTextContent('48.2,16.37');
    });
  });

  describe('delay reporting', () => {
    it('renders report delay button', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByRole('button', { name: /Report delay/ })).toBeInTheDocument();
    });

    it('opens report delay dialog when button is clicked', async () => {
      const user = userEvent.setup();
      const schedules = [createMockSchedule('sched_1')];
      mockBuses.mockReturnValue(busesLoaded([]));
      mockProviderTracking.mockReturnValue(trackingLoaded([]));
      mockSchedules.mockReturnValue(schedulesLoaded(schedules));
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: /Report delay/ }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Report delay', { selector: 'h2' })).toBeInTheDocument();
    });

    it('shows schedule dropdown in delay dialog', async () => {
      const user = userEvent.setup();
      const schedules = [createMockSchedule('sched_1')];
      mockBuses.mockReturnValue(busesLoaded([]));
      mockProviderTracking.mockReturnValue(trackingLoaded([]));
      mockSchedules.mockReturnValue(schedulesLoaded(schedules));
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: /Report delay/ }));

      expect(screen.getByLabelText('Schedule')).toBeInTheDocument();
      expect(screen.getByLabelText('Delay (minutes)')).toBeInTheDocument();
      expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    });

    it('validates required fields in delay form', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(busesLoaded([]));
      mockProviderTracking.mockReturnValue(trackingLoaded([]));
      mockSchedules.mockReturnValue(schedulesLoaded([]));
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: /Report delay/ }));

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /Report delay/ });
      await user.click(submitButton);

      expect(screen.getByText('Schedule is required')).toBeInTheDocument();
      expect(screen.getByText('Reason is required')).toBeInTheDocument();
    });

    it('submits delay form with valid data', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const schedules = [createMockSchedule('sched_1')];
      mockBuses.mockReturnValue(busesLoaded([]));
      mockProviderTracking.mockReturnValue(trackingLoaded([]));
      mockSchedules.mockReturnValue(schedulesLoaded(schedules));
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue({ mutate: mutateFn, isPending: false });
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: /Report delay/ }));

      await user.selectOptions(screen.getByLabelText('Schedule'), 'sched_1');
      await user.clear(screen.getByLabelText('Delay (minutes)'));
      await user.type(screen.getByLabelText('Delay (minutes)'), '15');
      await user.selectOptions(screen.getByLabelText('Reason'), 'TRAFFIC');

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /Report delay/ });
      await user.click(submitButton);

      expect(mutateFn).toHaveBeenCalledTimes(1);
      expect(mutateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: 'sched_1',
          offsetMinutes: 15,
          reason: 'TRAFFIC',
        }),
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  describe('active delays', () => {
    it('shows active delays when bus with schedule is selected', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1', { scheduleId: 'sched_1' })];
      const delays = [createMockDelay('delay_1', true)];
      mockBuses.mockReturnValue(busesLoaded(buses));
      mockProviderTracking.mockReturnValue(trackingLoaded(tracking));
      mockSchedules.mockReturnValue(schedulesLoaded([]));
      mockDelays.mockReturnValue(delaysLoaded(delays));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: 'Select bus AB-123' }));

      expect(screen.getByText('Active delays')).toBeInTheDocument();
      expect(screen.getByText(/\+15 min — Traffic/)).toBeInTheDocument();
    });

    it('shows deactivate button for active delays', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1', { scheduleId: 'sched_1' })];
      const delays = [createMockDelay('delay_1', true)];
      mockBuses.mockReturnValue(busesLoaded(buses));
      mockProviderTracking.mockReturnValue(trackingLoaded(tracking));
      mockSchedules.mockReturnValue(schedulesLoaded([]));
      mockDelays.mockReturnValue(delaysLoaded(delays));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: 'Select bus AB-123' }));

      expect(
        screen.getByRole('button', { name: 'Deactivate delay of 15 minutes' }),
      ).toBeInTheDocument();
    });

    it('calls updateDelay to deactivate a delay', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1', { scheduleId: 'sched_1' })];
      const delays = [createMockDelay('delay_1', true)];
      mockBuses.mockReturnValue(busesLoaded(buses));
      mockProviderTracking.mockReturnValue(trackingLoaded(tracking));
      mockSchedules.mockReturnValue(schedulesLoaded([]));
      mockDelays.mockReturnValue(delaysLoaded(delays));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: 'Select bus AB-123' }));
      await user.click(screen.getByRole('button', { name: 'Deactivate delay of 15 minutes' }));

      expect(mutateFn).toHaveBeenCalledWith({ id: 'delay_1', body: { active: false } });
    });

    it('shows "No active delays" when no delays exist', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123')];
      const tracking = [createMockTracking('bus_1', { scheduleId: 'sched_1' })];
      mockBuses.mockReturnValue(busesLoaded(buses));
      mockProviderTracking.mockReturnValue(trackingLoaded(tracking));
      mockSchedules.mockReturnValue(schedulesLoaded([]));
      mockDelays.mockReturnValue(delaysLoaded([]));
      mockCreateDelay.mockReturnValue(idleMutation());
      mockUpdateDelay.mockReturnValue(idleMutation());

      renderWithProviders(<ProviderTrackingPage />);

      await user.click(screen.getByRole('button', { name: 'Select bus AB-123' }));

      expect(screen.getByText('No active delays')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByRole('heading', { level: 2, name: 'Fleet tracking' })).toBeInTheDocument();
    });

    it('sidebar has aria-label', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByLabelText('Fleet tracking sidebar')).toBeInTheDocument();
    });

    it('map region has aria-label', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByLabelText('Live route map')).toBeInTheDocument();
    });

    it('bus select buttons have descriptive aria labels', () => {
      const buses = [createMockBus('bus_1', 'AB-123')];
      setupDefaults(buses, []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(screen.getByRole('button', { name: 'Select bus AB-123' })).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const buses = [createMockBus('bus_1', 'AB-123')];
      setupDefaults(buses, []);

      const { container } = renderWithProviders(<ProviderTrackingPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('responsive layout', () => {
    it('uses responsive flex layout (column on mobile, row on desktop)', () => {
      setupDefaults([], []);

      const { container } = renderWithProviders(<ProviderTrackingPage />);

      const mainLayout = container.querySelector('.flex.flex-col.lg\\:flex-row');
      expect(mainLayout).toBeInTheDocument();
    });

    it('sidebar has responsive width', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      const sidebar = screen.getByLabelText('Fleet tracking sidebar');
      expect(sidebar).toHaveClass('lg:w-80');
    });
  });

  describe('data fetching', () => {
    it('fetches buses with pageSize 100', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(mockBuses).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    });

    it('fetches active schedules for delay form', () => {
      setupDefaults([], []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(mockSchedules).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      );
    });

    it('passes bus IDs to provider tracking hook', () => {
      const buses = [createMockBus('bus_1', 'AB-123'), createMockBus('bus_2', 'CD-456')];
      setupDefaults(buses, []);

      renderWithProviders(<ProviderTrackingPage />);

      expect(mockProviderTracking).toHaveBeenCalledWith(['bus_1', 'bus_2'], true);
    });
  });
});
