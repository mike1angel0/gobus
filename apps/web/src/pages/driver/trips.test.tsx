import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DriverTripsPage from './trips';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockDriverTrips = vi.fn();

vi.mock('@/hooks/use-driver-trips', () => ({
  useDriverTrips: (...args: unknown[]) => mockDriverTrips(...args),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

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

/** Creates a mock driver trip. */
function createMockTrip(scheduleId: string, overrides: Record<string, unknown> = {}) {
  return {
    scheduleId,
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    tripDate: '2026-04-01T00:00:00Z',
    routeName: 'Bucharest - Cluj',
    busLicensePlate: 'B-123-ABC',
    status: 'ACTIVE',
    ...overrides,
  };
}

/* ---------- Setup ---------- */

beforeEach(() => {
  vi.clearAllMocks();
  mockDriverTrips.mockReturnValue(loadedState([]));
});

/* ---------- Tests ---------- */

describe('DriverTripsPage', () => {
  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockDriverTrips.mockReturnValue(loadingState());
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByLabelText('Loading trips')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('error state', () => {
    it('renders error message with retry button', async () => {
      const refetch = vi.fn();
      mockDriverTrips.mockReturnValue({ ...errorState(), refetch });
      const user = userEvent.setup();
      renderWithProviders(<DriverTripsPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load trips')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('renders empty state when no trips', () => {
      mockDriverTrips.mockReturnValue(loadedState([]));
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByText('No trips assigned for this date')).toBeInTheDocument();
    });
  });

  describe('loaded state', () => {
    it('renders trip cards with route name and times', () => {
      const trips = [
        createMockTrip('sched_1', { routeName: 'Bucharest - Cluj' }),
        createMockTrip('sched_2', { routeName: 'Timisoara - Iasi', busLicensePlate: 'TM-999-XY' }),
      ];
      mockDriverTrips.mockReturnValue(loadedState(trips));
      renderWithProviders(<DriverTripsPage />);

      expect(screen.getByText('Bucharest - Cluj')).toBeInTheDocument();
      expect(screen.getByText('Timisoara - Iasi')).toBeInTheDocument();
      expect(screen.getByText('B-123-ABC')).toBeInTheDocument();
      expect(screen.getByText('TM-999-XY')).toBeInTheDocument();
    });

    it('renders status badges based on time', () => {
      const futureTrip = createMockTrip('sched_1', {
        departureTime: '2099-01-01T08:00:00Z',
        arrivalTime: '2099-01-01T12:00:00Z',
      });
      mockDriverTrips.mockReturnValue(loadedState([futureTrip]));
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });

    it('renders cancelled badge for cancelled trips', () => {
      const cancelled = createMockTrip('sched_1', { status: 'CANCELLED' });
      mockDriverTrips.mockReturnValue(loadedState([cancelled]));
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('renders in-progress badge for trips currently running', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const inProgress = createMockTrip('sched_1', {
        departureTime: oneHourAgo,
        arrivalTime: oneHourLater,
      });
      mockDriverTrips.mockReturnValue(loadedState([inProgress]));
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('renders completed badge for past trips', () => {
      const completed = createMockTrip('sched_1', {
        departureTime: '2020-01-01T08:00:00Z',
        arrivalTime: '2020-01-01T12:00:00Z',
      });
      mockDriverTrips.mockReturnValue(loadedState([completed]));
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('navigates to trip detail on card click', async () => {
      const user = userEvent.setup();
      const trip = createMockTrip('sched_abc');
      mockDriverTrips.mockReturnValue(loadedState([trip]));
      renderWithProviders(<DriverTripsPage />);

      await user.click(screen.getByText('Bucharest - Cluj'));
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/driver/trip/sched_abc'));
    });

    it('navigates to trip detail on Enter key', async () => {
      const user = userEvent.setup();
      const trip = createMockTrip('sched_abc');
      mockDriverTrips.mockReturnValue(loadedState([trip]));
      renderWithProviders(<DriverTripsPage />);

      const card = screen.getByRole('button', { name: /Trip Bucharest - Cluj/ });
      card.focus();
      await user.keyboard('{Enter}');
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/driver/trip/sched_abc'));
    });
  });

  describe('date navigation', () => {
    it('renders date navigation with prev/next buttons', () => {
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByLabelText('Previous day')).toBeInTheDocument();
      expect(screen.getByLabelText('Next day')).toBeInTheDocument();
    });

    it('shows Today badge for current date', () => {
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('navigates to previous day on prev click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripsPage />);

      await user.click(screen.getByLabelText('Previous day'));

      // After clicking prev, useDriverTrips should be called with yesterday's date
      const lastCall = mockDriverTrips.mock.calls[mockDriverTrips.mock.calls.length - 1];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expectedDate = yesterday.toISOString().slice(0, 10);
      expect(lastCall[0]).toEqual(expect.objectContaining({ date: expectedDate }));
    });

    it('navigates to next day on next click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripsPage />);

      await user.click(screen.getByLabelText('Next day'));

      const lastCall = mockDriverTrips.mock.calls[mockDriverTrips.mock.calls.length - 1];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedDate = tomorrow.toISOString().slice(0, 10);
      expect(lastCall[0]).toEqual(expect.objectContaining({ date: expectedDate }));
    });

    it('removes Today badge after navigating away', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripsPage />);

      await user.click(screen.getByLabelText('Next day'));
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockDriverTrips.mockReturnValue(loadedState([]));
      renderWithProviders(<DriverTripsPage />);
      expect(screen.getByRole('heading', { level: 1, name: 'My Trips' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Trips' })).toBeInTheDocument();
    });

    it('has aria-live region for date changes', () => {
      renderWithProviders(<DriverTripsPage />);
      const dateDisplay = screen.getByText(/Today/i).closest('[aria-live]');
      expect(dateDisplay).toHaveAttribute('aria-live', 'polite');
    });

    it('trip cards are keyboard navigable', () => {
      const trip = createMockTrip('sched_1');
      mockDriverTrips.mockReturnValue(loadedState([trip]));
      renderWithProviders(<DriverTripsPage />);

      const card = screen.getByRole('button', { name: /Trip Bucharest - Cluj/ });
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('uses section landmark for trip list', () => {
      renderWithProviders(<DriverTripsPage />);
      const section = screen.getByRole('region', { name: 'Trips' });
      expect(section).toBeInTheDocument();
    });
  });

  describe('hook integration', () => {
    it('passes date parameter to useDriverTrips', () => {
      renderWithProviders(<DriverTripsPage />);
      const todayStr = new Date().toISOString().slice(0, 10);
      expect(mockDriverTrips).toHaveBeenCalledWith(expect.objectContaining({ date: todayStr }));
    });
  });
});
