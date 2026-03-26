import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProviderSchedulesPage from './schedules';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockSchedules = vi.fn();
const mockCancelSchedule = vi.fn();
const mockUpdateSchedule = vi.fn();

vi.mock('@/hooks/use-schedules', () => ({
  useSchedules: (...args: unknown[]) => mockSchedules(...args),
  useCancelSchedule: () => mockCancelSchedule(),
  useUpdateSchedule: () => mockUpdateSchedule(),
  useCreateSchedule: () => ({ mutate: vi.fn(), isPending: false }),
}));

const mockRoutes = vi.fn();
const mockRouteDetail = vi.fn();

vi.mock('@/hooks/use-routes', () => ({
  useRoutes: (...args: unknown[]) => mockRoutes(...args),
  useRouteDetail: (...args: unknown[]) => mockRouteDetail(...args),
}));

const mockBuses = vi.fn();

vi.mock('@/hooks/use-buses', () => ({
  useBuses: (...args: unknown[]) => mockBuses(...args),
}));

const mockDrivers = vi.fn();

vi.mock('@/hooks/use-drivers', () => ({
  useDrivers: (...args: unknown[]) => mockDrivers(...args),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded list state. */
function loadedState(data: unknown[] = []) {
  return {
    data: { data, meta: { total: data.length, page: 1, pageSize: 50, totalPages: 1 } },
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

/** Creates a mock schedule. */
function createMockSchedule(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    routeId: 'route_1',
    busId: 'bus_1',
    driverId: null,
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    daysOfWeek: [1, 3, 5],
    basePrice: 25.0,
    status: 'ACTIVE',
    tripDate: '2026-04-01T00:00:00Z',
    createdAt: '2026-03-20T10:00:00Z',
    ...overrides,
  };
}

/** Returns a default idle mutation. */
function idleMutation() {
  return { mutate: vi.fn(), isPending: false };
}

/** Creates a mock route for dropdown. */
function createMockRoute(id: string, name: string) {
  return { id, name, providerId: 'prov_1', createdAt: '2026-03-20T10:00:00Z' };
}

/** Creates a mock bus for dropdown. */
function createMockBus(id: string, plate: string) {
  return {
    id,
    licensePlate: plate,
    model: 'Mercedes',
    capacity: 48,
    rows: 12,
    columns: 4,
    providerId: 'prov_1',
    createdAt: '2026-03-20T10:00:00Z',
  };
}

/** Creates a mock driver for dropdown. */
function createMockDriver(id: string, name: string) {
  return {
    id,
    name,
    email: `${name.toLowerCase()}@test.com`,
    phone: '+1234567890',
    createdAt: '2026-03-20T10:00:00Z',
  };
}

/** Sets up common default mocks. */
function setupDefaults() {
  mockCancelSchedule.mockReturnValue(idleMutation());
  mockUpdateSchedule.mockReturnValue(idleMutation());
  mockRoutes.mockReturnValue(
    loadedState([createMockRoute('route_1', 'Bucharest — Cluj')]),
  );
  mockBuses.mockReturnValue(
    loadedState([createMockBus('bus_1', 'AB-12-XYZ')]),
  );
  mockDrivers.mockReturnValue(
    loadedState([createMockDriver('driver_1', 'John Doe')]),
  );
  mockRouteDetail.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  });
}

/* ---------- Tests ---------- */

describe('ProviderSchedulesPage', () => {
  beforeEach(() => {
    mockSchedules.mockReset();
    mockCancelSchedule.mockReset();
    mockUpdateSchedule.mockReset();
    mockRoutes.mockReset();
    mockBuses.mockReset();
    mockDrivers.mockReset();
    mockRouteDetail.mockReset();
    setupDefaults();
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockSchedules.mockReturnValue(loadingState());

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByLabelText('Loading schedules')).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });
  });

  describe('error state', () => {
    it('renders error state with retry button', () => {
      const refetch = vi.fn();
      mockSchedules.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByText('Failed to load schedules')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('calls refetch when retry is clicked', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockSchedules.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<ProviderSchedulesPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('renders empty state when no schedules exist', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByText('No schedules yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first schedule to start offering trips.'),
      ).toBeInTheDocument();
    });
  });

  describe('loaded state', () => {
    it('renders schedule cards with route names and bus plates', () => {
      const schedules = [
        createMockSchedule('sched_1'),
        createMockSchedule('sched_2', {
          routeId: 'route_1',
          busId: 'bus_1',
          status: 'CANCELLED',
        }),
      ];
      mockSchedules.mockReturnValue(loadedState(schedules));

      renderWithProviders(<ProviderSchedulesPage />);

      // 2 cards + 1 filter dropdown option = 3 occurrences of route name
      expect(screen.getAllByText('Bucharest — Cluj')).toHaveLength(3);
      // 2 cards + 1 filter dropdown option = 3 occurrences of bus plate
      expect(screen.getAllByText('AB-12-XYZ')).toHaveLength(3);
    });

    it('displays schedule times and price', () => {
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1')]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByText('$25.00')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('displays days of week', () => {
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1', { daysOfWeek: [1, 3, 5] })]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByText('Mon, Wed, Fri')).toBeInTheDocument();
    });

    it('shows driver status as Unassigned when no driver', () => {
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1', { driverId: null })]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('shows driver status as Assigned when driver exists', () => {
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1', { driverId: 'driver_1' })]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByText('Assigned')).toBeInTheDocument();
    });
  });

  describe('filter bar', () => {
    it('renders all filter controls', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByLabelText('Route')).toBeInTheDocument();
      expect(screen.getByLabelText('Bus')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });

    it('populates route dropdown from routes query', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      const routeSelect = screen.getByLabelText('Route');
      const options = within(routeSelect).getAllByRole('option');
      expect(options).toHaveLength(2); // "All routes" + 1 route
      expect(options[1]).toHaveTextContent('Bucharest — Cluj');
    });

    it('populates bus dropdown from buses query', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      const busSelect = screen.getByLabelText('Bus');
      const options = within(busSelect).getAllByRole('option');
      expect(options).toHaveLength(2); // "All buses" + 1 bus
      expect(options[1]).toHaveTextContent('AB-12-XYZ');
    });

    it('passes filter values to useSchedules hook', async () => {
      const user = userEvent.setup();
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      await user.selectOptions(screen.getByLabelText('Status'), 'ACTIVE');

      // useSchedules should have been called with the status filter
      const lastCall = mockSchedules.mock.calls[mockSchedules.mock.calls.length - 1];
      expect(lastCall[0]).toEqual(
        expect.objectContaining({ status: 'ACTIVE' }),
      );
    });
  });

  describe('cancel schedule', () => {
    it('opens confirmation dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1')]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      await user.click(
        screen.getByRole('button', {
          name: /cancel schedule bucharest/i,
        }),
      );

      expect(
        screen.getByRole('heading', { name: 'Cancel schedule' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/are you sure you want to cancel this schedule/i),
      ).toBeInTheDocument();
    });

    it('calls cancel mutation on confirmation', async () => {
      const user = userEvent.setup();
      const mutate = vi.fn();
      mockCancelSchedule.mockReturnValue({ mutate, isPending: false });
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1')]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      await user.click(
        screen.getByRole('button', {
          name: /cancel schedule bucharest/i,
        }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Cancel schedule' }),
      );

      expect(mutate).toHaveBeenCalledWith('sched_1');
    });

    it('hides cancel button for cancelled schedules', () => {
      mockSchedules.mockReturnValue(
        loadedState([
          createMockSchedule('sched_1', { status: 'CANCELLED' }),
        ]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(
        screen.queryByRole('button', {
          name: /cancel schedule/i,
        }),
      ).not.toBeInTheDocument();
    });
  });

  describe('driver assignment', () => {
    it('shows assign button for schedules without driver', () => {
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1', { driverId: null })]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(
        screen.getByRole('button', { name: /assign driver/i }),
      ).toBeInTheDocument();
    });

    it('shows unassign button for schedules with driver', () => {
      mockSchedules.mockReturnValue(
        loadedState([
          createMockSchedule('sched_1', { driverId: 'driver_1' }),
        ]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(
        screen.getByRole('button', { name: /unassign driver/i }),
      ).toBeInTheDocument();
    });

    it('opens driver assignment dialog on assign click', async () => {
      const user = userEvent.setup();
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1', { driverId: null })]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      await user.click(
        screen.getByRole('button', { name: /assign driver/i }),
      );

      expect(screen.getByText('Assign driver')).toBeInTheDocument();
      expect(screen.getByLabelText('Driver')).toBeInTheDocument();
    });

    it('calls update mutation with driver on save', async () => {
      const user = userEvent.setup();
      const mutate = vi.fn();
      mockUpdateSchedule.mockReturnValue({ mutate, isPending: false });
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1', { driverId: null })]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      await user.click(
        screen.getByRole('button', { name: /assign driver/i }),
      );

      await user.selectOptions(screen.getByLabelText('Driver'), 'driver_1');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mutate).toHaveBeenCalledWith(
        { id: 'sched_1', body: { driverId: 'driver_1' } },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  describe('create schedule', () => {
    it('renders create schedule button', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      expect(
        screen.getByRole('button', { name: /create schedule/i }),
      ).toBeInTheDocument();
    });

    it('opens create dialog on button click', async () => {
      const user = userEvent.setup();
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      await user.click(
        screen.getByRole('button', { name: /create schedule/i }),
      );

      expect(
        screen.getByRole('heading', { name: 'Create schedule' }),
      ).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading structure', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Schedules' }),
      ).toBeInTheDocument();
    });

    it('has search landmark for filter bar', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByRole('search', { name: 'Schedule filters' })).toBeInTheDocument();
    });

    it('has aria-label on schedule list grid', () => {
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1')]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(screen.getByLabelText('Schedules list')).toBeInTheDocument();
    });

    it('cancel button has descriptive aria-label', () => {
      mockSchedules.mockReturnValue(
        loadedState([createMockSchedule('sched_1')]),
      );

      renderWithProviders(<ProviderSchedulesPage />);

      expect(
        screen.getByRole('button', {
          name: /cancel schedule bucharest/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe('responsive layout', () => {
    it('renders page with max width container', () => {
      mockSchedules.mockReturnValue(loadedState([]));

      const { container } = renderWithProviders(<ProviderSchedulesPage />);

      const wrapper = container.querySelector('.max-w-6xl');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
