import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { format } from 'date-fns';
import DriverTripDetailPage from './trip-detail';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockDriverTripDetail = vi.fn();
const mockDriverTripPassengers = vi.fn();

vi.mock('@/hooks/use-driver-trips', () => ({
  useDriverTripDetail: (...args: unknown[]) => mockDriverTripDetail(...args),
  useDriverTripPassengers: (...args: unknown[]) => mockDriverTripPassengers(...args),
}));

const mockUpdateTracking = { mutate: vi.fn(), isPending: false };

vi.mock('@/hooks/use-provider-tracking', () => ({
  useUpdateTracking: () => mockUpdateTracking,
}));

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'sched_abc' }),
    useSearchParams: () => [new URLSearchParams('date=2026-04-01')],
  };
});

vi.mock('@/components/maps/live-map', () => ({
  LiveMap: ({ stops, busPosition }: { stops: unknown[]; busPosition: unknown }) => (
    <div
      data-testid="live-map"
      data-stops={JSON.stringify(stops)}
      data-bus={JSON.stringify(busPosition)}
    >
      Live Map Mock
    </div>
  ),
}));

/* ---------- Helpers ---------- */

function createMockTripDetail(overrides: Record<string, unknown> = {}) {
  return {
    scheduleId: 'sched_abc',
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    tripDate: '2026-04-01T00:00:00Z',
    routeName: 'Bucharest - Cluj',
    busLicensePlate: 'B-123-ABC',
    busModel: 'Mercedes Tourismo',
    status: 'ACTIVE',
    passengerCount: 25,
    totalSeats: 50,
    stops: [
      {
        id: 'stop_1',
        stopName: 'Bucharest',
        arrivalTime: '2026-04-01T08:00:00Z',
        departureTime: '2026-04-01T08:05:00Z',
        orderIndex: 0,
        priceFromStart: 0,
      },
      {
        id: 'stop_2',
        stopName: 'Pitesti',
        arrivalTime: '2026-04-01T09:30:00Z',
        departureTime: '2026-04-01T09:35:00Z',
        orderIndex: 1,
        priceFromStart: 15,
      },
      {
        id: 'stop_3',
        stopName: 'Sibiu',
        arrivalTime: '2026-04-01T11:00:00Z',
        departureTime: '2026-04-01T11:05:00Z',
        orderIndex: 2,
        priceFromStart: 30,
      },
      {
        id: 'stop_4',
        stopName: 'Cluj-Napoca',
        arrivalTime: '2026-04-01T12:00:00Z',
        departureTime: '2026-04-01T12:00:00Z',
        orderIndex: 3,
        priceFromStart: 45,
      },
    ],
    ...overrides,
  };
}

function loadedState(trip: unknown = createMockTripDetail()) {
  return {
    data: { data: trip },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function loadingState() {
  return { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
}

function errorState() {
  return { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
}

/* ---------- Setup ---------- */

beforeEach(() => {
  vi.clearAllMocks();
  mockDriverTripDetail.mockReturnValue(loadedState());
  mockDriverTripPassengers.mockReturnValue({
    data: { data: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });

  // Mock geolocation API
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  // Mock permissions API
  Object.defineProperty(navigator, 'permissions', {
    value: {
      query: vi.fn().mockResolvedValue({
        state: 'prompt',
        addEventListener: vi.fn(),
      }),
    },
    writable: true,
    configurable: true,
  });
});

/* ---------- Tests ---------- */

describe('DriverTripDetailPage', () => {
  describe('loading state', () => {
    it('renders skeleton loader while loading', () => {
      mockDriverTripDetail.mockReturnValue(loadingState());
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByLabelText('Loading trip details')).toHaveAttribute('aria-busy', 'true');
    });

    it('shows page title during loading', () => {
      mockDriverTripDetail.mockReturnValue(loadingState());
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('heading', { level: 1, name: 'Trip Details' })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error message with retry button', async () => {
      const refetch = vi.fn();
      mockDriverTripDetail.mockReturnValue({ ...errorState(), refetch });
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load trip details')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('trip info', () => {
    it('renders route name and status', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('Bucharest - Cluj')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('renders times in HH:mm format', () => {
      renderWithProviders(<DriverTripDetailPage />);
      const depTime = format(new Date('2026-04-01T08:00:00Z'), 'HH:mm');
      const arrTime = format(new Date('2026-04-01T12:00:00Z'), 'HH:mm');
      expect(screen.getByText(new RegExp(`${depTime} → ${arrTime}`))).toBeInTheDocument();
    });

    it('renders bus info', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('B-123-ABC · Mercedes Tourismo')).toBeInTheDocument();
    });

    it('renders passenger count', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('25 / 50 passengers')).toBeInTheDocument();
    });

    it('renders cancelled badge for cancelled trips', () => {
      mockDriverTripDetail.mockReturnValue(
        loadedState(createMockTripDetail({ status: 'CANCELLED' })),
      );
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  describe('live map', () => {
    it('renders the live map component', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByTestId('live-map')).toBeInTheDocument();
      expect(screen.getByText('Live Map Mock')).toBeInTheDocument();
    });

    it('has accessible map section with sr-only heading', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('heading', { name: 'Live Map' })).toBeInTheDocument();
    });
  });

  describe('location sharing', () => {
    it('renders location sharing toggle', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('Location Sharing')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start sharing location' })).toBeInTheDocument();
    });

    it('shows start sharing button when not sharing', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('button', { name: 'Start sharing location' })).toHaveTextContent(
        'Start Sharing',
      );
    });

    it('shows denied message when permission is denied', async () => {
      (navigator.permissions.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        state: 'denied',
        addEventListener: vi.fn(),
      });
      renderWithProviders(<DriverTripDetailPage />);

      // Wait for permission check
      await screen.findByText('Location permission denied. Enable in browser settings.');
      expect(screen.getByRole('button', { name: 'Start sharing location' })).toBeDisabled();
    });

    it('calls geolocation watchPosition when start sharing clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Start sharing location' }));
      expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    });

    it('updates position when geolocation reports coordinates', async () => {
      (navigator.geolocation.watchPosition as ReturnType<typeof vi.fn>).mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: {
              latitude: 44.43,
              longitude: 26.1,
              heading: 90,
              speed: 16.67,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
          return 1;
        },
      );

      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Start sharing location' }));

      // Map should now have bus position data
      const mapEl = screen.getByTestId('live-map');
      const bus = JSON.parse(mapEl.getAttribute('data-bus') ?? 'null') as Record<
        string,
        number
      > | null;
      expect(bus).not.toBeNull();
      expect(bus?.lat).toBe(44.43);
    });

    it('handles geolocation permission denied error', async () => {
      (navigator.geolocation.watchPosition as ReturnType<typeof vi.fn>).mockImplementation(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1, // PERMISSION_DENIED
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
          return 1;
        },
      );

      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Start sharing location' }));

      // Should show denied message after permission error
      expect(
        screen.getByText('Location permission denied. Enable in browser settings.'),
      ).toBeInTheDocument();
    });

    it('handles geolocation position with null heading and speed', async () => {
      (navigator.geolocation.watchPosition as ReturnType<typeof vi.fn>).mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: {
              latitude: 44.43,
              longitude: 26.1,
              heading: null,
              speed: null,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
          return 1;
        },
      );

      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Start sharing location' }));

      const mapEl = screen.getByTestId('live-map');
      const bus = JSON.parse(mapEl.getAttribute('data-bus') ?? 'null') as Record<
        string,
        number
      > | null;
      expect(bus).not.toBeNull();
      expect(bus?.heading).toBe(0);
    });

    it('shows toast when sharing starts', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Start sharing location' }));
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Location sharing started' }),
      );
    });
  });

  describe('stop progress', () => {
    it('renders all stops in order', () => {
      renderWithProviders(<DriverTripDetailPage />);
      const list = screen.getByLabelText('Stop progress');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(4);
      expect(items[0]).toHaveTextContent('Bucharest');
      expect(items[1]).toHaveTextContent('Pitesti');
      expect(items[2]).toHaveTextContent('Sibiu');
      expect(items[3]).toHaveTextContent('Cluj-Napoca');
    });

    it('shows arrival times for stops', () => {
      renderWithProviders(<DriverTripDetailPage />);
      const stop1Time = format(new Date('2026-04-01T08:00:00Z'), 'HH:mm');
      const stop2Time = format(new Date('2026-04-01T09:30:00Z'), 'HH:mm');
      expect(screen.getByText(stop1Time)).toBeInTheDocument();
      expect(screen.getByText(stop2Time)).toBeInTheDocument();
    });

    it('marks first stop as current by default', () => {
      renderWithProviders(<DriverTripDetailPage />);
      const list = screen.getByLabelText('Stop progress');
      const items = within(list).getAllByRole('listitem');
      expect(items[0]).toHaveAttribute('aria-current', 'step');
    });

    it('renders advance button', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('button', { name: /Arrived at Pitesti/ })).toBeInTheDocument();
    });

    it('advances stop index on button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: /Arrived at Pitesti/ }));

      // After advancing, current stop should be Pitesti (index 1)
      const list = screen.getByLabelText('Stop progress');
      const items = within(list).getAllByRole('listitem');
      expect(items[1]).toHaveAttribute('aria-current', 'step');
      // Bucharest should now show as passed (checkmark)
      expect(within(items[0]).getByLabelText('Passed')).toBeInTheDocument();
    });

    it('shows toast when advancing stop', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: /Arrived at Pitesti/ }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stop updated' }));
    });

    it('shows "All stops completed" when at last stop', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      // Advance through all stops
      await user.click(screen.getByRole('button', { name: /Arrived at Pitesti/ }));
      await user.click(screen.getByRole('button', { name: /Arrived at Sibiu/ }));
      await user.click(screen.getByRole('button', { name: /Arrived at Cluj-Napoca/ }));

      expect(screen.getByText('All stops completed')).toBeInTheDocument();
    });
  });

  describe('passenger manifest', () => {
    it('renders passenger manifest section', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('Passenger Manifest')).toBeInTheDocument();
    });

    it('renders passenger count from header info', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('25 / 50 passengers')).toBeInTheDocument();
    });

    it('shows empty state when no passengers loaded', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('No passengers booked for this trip')).toBeInTheDocument();
    });
  });

  describe('report delay', () => {
    it('renders report delay button', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('button', { name: 'Report a delay' })).toBeInTheDocument();
    });

    it('navigates to delay page on click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Report a delay' }));
      expect(mockNavigate).toHaveBeenCalledWith(
        '/driver/delay?scheduleId=sched_abc&date=2026-04-01',
      );
    });
  });

  describe('navigation', () => {
    it('renders back button', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('button', { name: 'Back to trips list' })).toBeInTheDocument();
    });

    it('navigates to trips list on back click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Back to trips list' }));
      expect(mockNavigate).toHaveBeenCalledWith('/driver');
    });
  });

  describe('hook integration', () => {
    it('passes scheduleId and date to useDriverTripDetail', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(mockDriverTripDetail).toHaveBeenCalledWith('sched_abc', '2026-04-01');
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('heading', { level: 1, name: 'Trip Details' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Live Map' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Stop Progress' })).toBeInTheDocument();
    });

    it('has labeled sections for screen readers', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByRole('region', { name: 'Live Map' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Stop Progress' })).toBeInTheDocument();
    });

    it('uses sr-only labels for data list items', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByText('Times')).toHaveClass('sr-only');
      expect(screen.getByText('Bus')).toHaveClass('sr-only');
    });

    it('buttons have accessible labels', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByLabelText('Back to trips list')).toBeInTheDocument();
      expect(screen.getByLabelText('Report a delay')).toBeInTheDocument();
      expect(screen.getByLabelText('Start sharing location')).toBeInTheDocument();
    });

    it('stop progress list is labeled', () => {
      renderWithProviders(<DriverTripDetailPage />);
      expect(screen.getByLabelText('Stop progress')).toBeInTheDocument();
    });
  });

  describe('stops without coordinates', () => {
    it('filters out stops missing lat/lng from map data', () => {
      const trip = createMockTripDetail({
        stops: [
          {
            id: 'stop_1',
            stopName: 'Bucharest',
            arrivalTime: '2026-04-01T08:00:00Z',
            departureTime: '2026-04-01T08:05:00Z',
            orderIndex: 0,
            priceFromStart: 0,
            lat: 44.43,
            lng: 26.1,
          },
          {
            id: 'stop_2',
            stopName: 'Pitesti',
            arrivalTime: '2026-04-01T09:30:00Z',
            departureTime: '2026-04-01T09:35:00Z',
            orderIndex: 1,
            priceFromStart: 15,
            // no lat/lng — should be filtered from map
          },
        ],
      });
      mockDriverTripDetail.mockReturnValue(loadedState(trip));
      renderWithProviders(<DriverTripDetailPage />);

      const mapEl = screen.getByTestId('live-map');
      const stops = JSON.parse(mapEl.getAttribute('data-stops') ?? '[]') as unknown[];
      expect(stops).toHaveLength(1);
    });
  });

  describe('stop sharing', () => {
    it('shows toast when sharing is stopped', async () => {
      const watchId = 42;
      (navigator.geolocation.watchPosition as ReturnType<typeof vi.fn>).mockReturnValue(watchId);

      const user = userEvent.setup();
      renderWithProviders(<DriverTripDetailPage />);

      // Start sharing
      await user.click(screen.getByRole('button', { name: 'Start sharing location' }));
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Location sharing started' }),
      );

      // Stop sharing
      await user.click(screen.getByRole('button', { name: 'Stop sharing location' }));
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Location sharing stopped' }),
      );
      expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(watchId);
    });
  });

  describe('geolocation cleanup', () => {
    it('calls clearWatch when component unmounts while sharing', async () => {
      const watchId = 42;
      (navigator.geolocation.watchPosition as ReturnType<typeof vi.fn>).mockReturnValue(watchId);

      const user = userEvent.setup();
      const { unmount } = renderWithProviders(<DriverTripDetailPage />);

      await user.click(screen.getByRole('button', { name: 'Start sharing location' }));
      unmount();

      expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(watchId);
    });
  });
});
