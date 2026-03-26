import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProviderDashboardPage from './dashboard';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockRoutes = vi.fn();
const mockBuses = vi.fn();
const mockDrivers = vi.fn();
const mockSchedules = vi.fn();

vi.mock('@/hooks/use-routes', () => ({
  useRoutes: (...args: unknown[]) => mockRoutes(...args),
}));

vi.mock('@/hooks/use-buses', () => ({
  useBuses: (...args: unknown[]) => mockBuses(...args),
}));

vi.mock('@/hooks/use-drivers', () => ({
  useDrivers: (...args: unknown[]) => mockDrivers(...args),
}));

vi.mock('@/hooks/use-schedules', () => ({
  useSchedules: (...args: unknown[]) => mockSchedules(...args),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Test Provider' }, isAuthenticated: true }),
}));

/* ---------- Helpers ---------- */

/** Returns a default loaded state for a hook with the given meta total. */
function loadedState(total: number, data: unknown[] = []) {
  return {
    data: { data, meta: { total, page: 1, pageSize: 10, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns a loading state for a hook. */
function loadingState() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns an error state for a hook. */
function errorState() {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  };
}

/** Creates a mock schedule object. */
function createMockSchedule(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    routeId: 'route_1',
    busId: 'bus_1',
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    basePrice: 25.5,
    status: 'ACTIVE' as const,
    tripDate: '2026-04-01',
    ...overrides,
  };
}

/* ---------- Tests ---------- */

describe('ProviderDashboardPage', () => {
  beforeEach(() => {
    mockRoutes.mockReset();
    mockBuses.mockReset();
    mockDrivers.mockReset();
    mockSchedules.mockReset();
  });

  describe('loading state', () => {
    it('renders skeleton loaders while data is loading', () => {
      mockRoutes.mockReturnValue(loadingState());
      mockBuses.mockReturnValue(loadingState());
      mockDrivers.mockReturnValue(loadingState());
      mockSchedules.mockReturnValue(loadingState());

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByLabelText('Loading dashboard statistics')).toHaveAttribute(
        'aria-busy',
        'true',
      );
      expect(screen.getByLabelText('Loading upcoming schedules')).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });
  });

  describe('loaded state', () => {
    it('renders stat cards with correct values', () => {
      mockRoutes.mockReturnValue(loadedState(5));
      mockBuses.mockReturnValue(loadedState(12));
      mockDrivers.mockReturnValue(loadedState(8));
      mockSchedules.mockReturnValue(loadedState(3));

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Routes')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Buses')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('Drivers')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Active schedules')).toBeInTheDocument();
    });

    it('renders welcome message with user name', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Welcome back, Test Provider',
      );
    });

    it('renders upcoming schedules list', () => {
      const schedules = [
        createMockSchedule('sched_1', { basePrice: 25.5 }),
        createMockSchedule('sched_2', { basePrice: 30.0 }),
      ];
      mockRoutes.mockReturnValue(loadedState(2));
      mockBuses.mockReturnValue(loadedState(3));
      mockDrivers.mockReturnValue(loadedState(1));
      mockSchedules.mockReturnValue(loadedState(2, schedules));

      renderWithProviders(<ProviderDashboardPage />);

      const list = screen.getByRole('list', { name: 'Upcoming schedules' });
      expect(list).toBeInTheDocument();
      expect(list.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getByText('$25.50')).toBeInTheDocument();
      expect(screen.getByText('$30.00')).toBeInTheDocument();
    });

    it('renders empty state when no upcoming schedules', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByText('No upcoming schedules')).toBeInTheDocument();
    });

    it('renders quick action buttons', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByRole('link', { name: /Create route/ })).toHaveAttribute(
        'href',
        '/provider/routes',
      );
      expect(screen.getByRole('link', { name: /Create schedule/ })).toHaveAttribute(
        'href',
        '/provider/schedules',
      );
      expect(screen.getByRole('link', { name: /Add bus/ })).toHaveAttribute(
        'href',
        '/provider/fleet',
      );
      expect(screen.getByRole('link', { name: /Add driver/ })).toHaveAttribute(
        'href',
        '/provider/drivers',
      );
    });

    it('stat cards link to the correct management pages', () => {
      mockRoutes.mockReturnValue(loadedState(1));
      mockBuses.mockReturnValue(loadedState(1));
      mockDrivers.mockReturnValue(loadedState(1));
      mockSchedules.mockReturnValue(loadedState(1));

      renderWithProviders(<ProviderDashboardPage />);

      const routesLink = screen.getByText('Routes').closest('a');
      expect(routesLink).toHaveAttribute('href', '/provider/routes');

      const busesLink = screen.getByText('Buses').closest('a');
      expect(busesLink).toHaveAttribute('href', '/provider/fleet');

      const driversLink = screen.getByText('Drivers').closest('a');
      expect(driversLink).toHaveAttribute('href', '/provider/drivers');

      const schedulesLink = screen.getByText('Active schedules').closest('a');
      expect(schedulesLink).toHaveAttribute('href', '/provider/schedules');
    });
  });

  describe('error state', () => {
    it('renders error state when all queries fail', () => {
      mockRoutes.mockReturnValue(errorState());
      mockBuses.mockReturnValue(errorState());
      mockDrivers.mockReturnValue(errorState());
      mockSchedules.mockReturnValue(errorState());

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const routesRefetch = vi.fn();
      const busesRefetch = vi.fn();
      const driversRefetch = vi.fn();
      const schedulesRefetch = vi.fn();

      mockRoutes.mockReturnValue({ ...errorState(), refetch: routesRefetch });
      mockBuses.mockReturnValue({ ...errorState(), refetch: busesRefetch });
      mockDrivers.mockReturnValue({ ...errorState(), refetch: driversRefetch });
      mockSchedules.mockReturnValue({ ...errorState(), refetch: schedulesRefetch });

      renderWithProviders(<ProviderDashboardPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(routesRefetch).toHaveBeenCalledTimes(1);
      expect(busesRefetch).toHaveBeenCalledTimes(1);
      expect(driversRefetch).toHaveBeenCalledTimes(1);
      expect(schedulesRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Welcome back, Test Provider',
      );
      // sr-only h2 headings for sections
      expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Upcoming schedules' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Quick actions' })).toBeInTheDocument();
    });

    it('uses landmark sections with aria-labelledby', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      expect(screen.getByLabelText('Statistics')).toBeInTheDocument();
      expect(screen.getByLabelText('Upcoming schedules')).toBeInTheDocument();
      expect(screen.getByLabelText('Quick actions')).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const schedules = [createMockSchedule('sched_1')];
      mockRoutes.mockReturnValue(loadedState(1));
      mockBuses.mockReturnValue(loadedState(1));
      mockDrivers.mockReturnValue(loadedState(1));
      mockSchedules.mockReturnValue(loadedState(1, schedules));

      const { container } = renderWithProviders(<ProviderDashboardPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('responsive layout', () => {
    it('stats grid uses responsive classes', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      const statsSection = screen.getByLabelText('Statistics');
      const grid = statsSection.querySelector('.grid');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4');
    });
  });

  describe('data fetching', () => {
    it('fetches routes with pageSize 1 for count only', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      expect(mockRoutes).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
    });

    it('fetches schedules with ACTIVE status and limit of 5', () => {
      mockRoutes.mockReturnValue(loadedState(0));
      mockBuses.mockReturnValue(loadedState(0));
      mockDrivers.mockReturnValue(loadedState(0));
      mockSchedules.mockReturnValue(loadedState(0));

      renderWithProviders(<ProviderDashboardPage />);

      expect(mockSchedules).toHaveBeenCalledWith({
        status: 'ACTIVE',
        page: 1,
        pageSize: 5,
      });
    });
  });
});
