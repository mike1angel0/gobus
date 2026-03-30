import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import MyTripsPage from './my-trips';
import { renderWithProviders } from '@/test/helpers';

const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, DELETE: mockDelete }),
}));

vi.mock('@/components/maps/live-map', () => ({
  LiveMap: ({ stops, busPosition }: { stops: unknown[]; busPosition?: unknown }) => (
    <div data-testid="live-map" data-stops={stops.length} data-bus={busPosition ? 'yes' : 'no'} />
  ),
}));

/** Creates a mock booking with defaults. */
function createBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bk_1',
    orderId: 'ORD-001',
    userId: 'user_1',
    scheduleId: 'sched_1',
    totalPrice: 45.0,
    status: 'CONFIRMED',
    boardingStop: 'Berlin',
    alightingStop: 'Prague',
    tripDate: '2099-04-01T08:00:00Z',
    seatLabels: ['1A', '1B'],
    createdAt: '2026-03-20T10:00:00Z',
    ...overrides,
  };
}

const mockBookingDetail = {
  id: 'bk_1',
  orderId: 'ORD-001',
  userId: 'user_1',
  scheduleId: 'sched_1',
  totalPrice: 45.0,
  status: 'CONFIRMED',
  boardingStop: 'Berlin',
  alightingStop: 'Prague',
  tripDate: '2099-04-01T08:00:00Z',
  seatLabels: ['1A', '1B'],
  createdAt: '2026-03-20T10:00:00Z',
  schedule: {
    departureTime: '2099-04-01T08:00:00Z',
    arrivalTime: '2099-04-01T12:00:00Z',
    route: {
      id: 'route_1',
      name: 'Berlin - Prague',
      provider: { id: 'prov_1', name: 'EuroBus' },
    },
    bus: {
      id: 'bus_1',
      licensePlate: 'AB-123-CD',
      model: 'Mercedes Tourismo',
    },
  },
};

const meta = { total: 2, page: 1, pageSize: 10, totalPages: 1 };

function mockBookingsResponse(bookings: unknown[], paginationMeta = meta) {
  return { data: { data: bookings, meta: paginationMeta } };
}

function mockDetailResponse(detail = mockBookingDetail) {
  return { data: { data: detail } };
}

function createDetailWithWindow(departureTime: string, arrivalTime: string) {
  return {
    ...mockBookingDetail,
    schedule: {
      ...mockBookingDetail.schedule,
      departureTime,
      arrivalTime,
    },
  };
}

function mockDelayListResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      data: [
        {
          id: 'delay_1',
          scheduleId: 'sched_1',
          offsetMinutes: 18,
          reason: 'TRAFFIC',
          note: 'Heavy traffic near the city entry corridor.',
          tripDate: todayDateString(),
          active: true,
          createdAt: '2026-03-20T10:30:00Z',
          ...overrides,
        },
      ],
      meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
    },
  };
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('MyTripsPage', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
    mockGet.mockReset();
    mockDelete.mockReset();
  });

  describe('loading state', () => {
    it('renders skeleton cards while loading', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      const loadingRegion = screen.getByLabelText('Loading bookings');
      expect(loadingRegion).toHaveAttribute('aria-busy', 'true');
    });

    it('does not render a spinner', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no bookings exist', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('No trips yet')).toBeInTheDocument();
      });

      expect(screen.getByText(/haven't booked any trips/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Search trips' })).toHaveAttribute('href', '/search');
    });
  });

  describe('error state', () => {
    it('renders error state with retry button', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('retries when retry button is clicked', async () => {
      const user = userEvent.setup();
      const upcomingBooking = createBooking();

      mockGet.mockRejectedValueOnce(new Error('Network error'));
      mockGet.mockResolvedValueOnce(mockBookingsResponse([upcomingBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });
    });
  });

  describe('tabs', () => {
    it('renders Active, Upcoming and Past tabs', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('tablist', { name: 'Trip categories' })).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: /active/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /upcoming/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /past/i })).toBeInTheDocument();
    });

    it('falls back to upcoming tab when there are no active trips', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /upcoming/i })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      });

      expect(screen.getByRole('tab', { name: /active/i })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: /past/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('shows active tab as selected when an in-progress trip exists', async () => {
      const now = Date.now();
      const activeBooking = createBooking({ tripDate: todayDateString() });
      const activeDetail = createDetailWithWindow(
        new Date(now - 60 * 60 * 1000).toISOString(),
        new Date(now + 60 * 60 * 1000).toISOString(),
      );

      mockGet.mockImplementation((path: string) => {
        if (path === '/api/v1/bookings') return Promise.resolve(mockBookingsResponse([activeBooking]));
        if (path === '/api/v1/bookings/{id}') return Promise.resolve(mockDetailResponse(activeDetail));
        return Promise.resolve({ data: { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } } });
      });

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /active/i })).toHaveAttribute('aria-selected', 'true');
      });

      expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
    });

    it('switches to past tab when clicked', async () => {
      const user = userEvent.setup();
      const pastBooking = createBooking({
        id: 'bk_2',
        orderId: 'ORD-002',
        status: 'COMPLETED',
        tripDate: '2024-01-01T08:00:00Z',
        boardingStop: 'Vienna',
        alightingStop: 'Budapest',
      });

      mockGet.mockResolvedValue(mockBookingsResponse([createBooking(), pastBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /past/i }));

      expect(screen.getByRole('tab', { name: /past/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Vienna → Budapest')).toBeInTheDocument();
    });

    it('shows empty message for active tab when no active bookings exist', async () => {
      mockGet.mockResolvedValue(
        mockBookingsResponse([
          createBooking({ status: 'COMPLETED', tripDate: '2024-01-01T08:00:00Z' }),
        ]),
      );

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        const activeTab = screen.getByRole('tab', { name: /active/i });
        expect(within(activeTab).getByText('0')).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByRole('tab', { name: /active/i }));

      await waitFor(() => {
        expect(screen.getByText('No active trips')).toBeInTheDocument();
      });
    });

    it('shows correct counts on tabs', async () => {
      const futureBooking = createBooking({
        id: 'bk_1',
        orderId: 'ORD-001',
        tripDate: '2099-12-31',
      });
      const pastBooking = createBooking({
        id: 'bk_2',
        orderId: 'ORD-002',
        status: 'COMPLETED',
        tripDate: '2024-01-01T08:00:00Z',
      });

      mockGet.mockResolvedValue(mockBookingsResponse([futureBooking, pastBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        const activeTab = screen.getByRole('tab', { name: /active/i });
        const upcomingTabCount = screen.getByRole('tab', { name: /upcoming/i });
        const pastTab = screen.getByRole('tab', { name: /past/i });

        expect(within(activeTab).getByText('0')).toBeInTheDocument();
        expect(within(upcomingTabCount).getByText('1')).toBeInTheDocument();
        expect(within(pastTab).getByText('1')).toBeInTheDocument();
      });
    });

    it('shows empty message for tab with no bookings', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue(
        mockBookingsResponse([
          createBooking({ status: 'COMPLETED', tripDate: '2024-01-01T08:00:00Z' }),
        ]),
      );

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /past/i })).toHaveAttribute('aria-selected', 'true');
      });

      await user.click(screen.getByRole('tab', { name: /upcoming/i }));

      await waitFor(() => {
        expect(screen.getByText('No upcoming trips')).toBeInTheDocument();
      });
    });
  });

  describe('booking cards', () => {
    it('displays booking information correctly', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });

      expect(screen.getByText('45,00 lei')).toBeInTheDocument();
      expect(screen.getByText('Seats: 1A, 1B')).toBeInTheDocument();
      expect(screen.getByText('Order: ORD-001')).toBeInTheDocument();
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    it('shows status badge with correct text for completed bookings', async () => {
      const user = userEvent.setup();
      const completedBooking = createBooking({
        id: 'bk_2',
        orderId: 'ORD-002',
        status: 'COMPLETED',
        tripDate: '2024-01-01T08:00:00Z',
      });

      mockGet.mockResolvedValue(mockBookingsResponse([completedBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      // Switch to past tab since completed is past
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /past/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /past/i }));

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });
  });

  describe('expandable detail', () => {
    it('expands and shows booking details when details button is clicked', async () => {
      const user = userEvent.setup();
      const now = Date.now();
      const inProgressDetail = createDetailWithWindow(
        new Date(now - 60 * 60 * 1000).toISOString(),
        new Date(now + 60 * 60 * 1000).toISOString(),
      );

      mockGet
        .mockResolvedValueOnce(mockBookingsResponse([createBooking()]))
        .mockResolvedValue(mockDetailResponse(inProgressDetail));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });

      const detailsButton = screen.getByRole('button', { name: 'Expand details' });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(detailsButton);

      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');

      await waitFor(() => {
        expect(screen.getByText(/EuroBus/)).toBeInTheDocument();
      });

      expect(screen.getByText('Trip status')).toBeInTheDocument();
      expect(screen.getByText('In progress')).toBeInTheDocument();
      expect(screen.getByText(/Mercedes Tourismo/)).toBeInTheDocument();
      expect(screen.getByText(/AB-123-CD/)).toBeInTheDocument();
      expect(screen.getByText('Berlin - Prague')).toBeInTheDocument();
    });

    it('collapses detail section when clicked again', async () => {
      const user = userEvent.setup();

      mockGet
        .mockResolvedValueOnce(mockBookingsResponse([createBooking()]))
        .mockResolvedValue(mockDetailResponse());

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });

      const detailsButton = screen.getByRole('button', { name: 'Expand details' });
      await user.click(detailsButton);

      await waitFor(() => {
        expect(screen.getByText(/EuroBus/)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Collapse details' }));

      expect(screen.queryByText(/Mercedes Tourismo/)).not.toBeInTheDocument();
    });

    it('shows scheduled status before departure in booking details', async () => {
      const user = userEvent.setup();
      const now = Date.now();
      const scheduledDetail = createDetailWithWindow(
        new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        new Date(now + 4 * 60 * 60 * 1000).toISOString(),
      );

      mockGet
        .mockResolvedValueOnce(mockBookingsResponse([createBooking()]))
        .mockResolvedValue(mockDetailResponse(scheduledDetail));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Expand details' }));

      await waitFor(() => {
        expect(screen.getByText('Scheduled')).toBeInTheDocument();
      });
    });

    it('shows a delay alert for delayed active trips', async () => {
      const user = userEvent.setup();
      const now = Date.now();
      const activeBooking = createBooking({ tripDate: todayDateString() });
      const delayedDetail = createDetailWithWindow(
        new Date(now - 60 * 60 * 1000).toISOString(),
        new Date(now + 60 * 60 * 1000).toISOString(),
      );

      mockGet.mockImplementation((path: string) => {
        if (path === '/api/v1/bookings') return Promise.resolve(mockBookingsResponse([activeBooking]));
        if (path === '/api/v1/bookings/{id}') return Promise.resolve(mockDetailResponse(delayedDetail));
        if (path === '/api/v1/delays') return Promise.resolve(mockDelayListResponse());
        return Promise.resolve({ data: { data: { isActive: false } } });
      });

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Expand details' }));

      await waitFor(() => {
        expect(screen.getByText('Service alert')).toBeInTheDocument();
      });

      expect(screen.getByText('+18min')).toBeInTheDocument();
      expect(screen.getByText(/currently delayed due to traffic/i)).toBeInTheDocument();
      expect(screen.getByText('Heavy traffic near the city entry corridor.')).toBeInTheDocument();
    });
  });

  describe('cancel booking', () => {
    it('shows cancel button only on upcoming confirmed bookings', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
      });
    });

    it('does not show cancel button on past bookings', async () => {
      const user = userEvent.setup();
      const pastBooking = createBooking({
        id: 'bk_2',
        status: 'COMPLETED',
        tripDate: '2024-01-01T08:00:00Z',
      });

      mockGet.mockResolvedValue(mockBookingsResponse([pastBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /past/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /past/i }));

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    });

    it('opens confirmation dialog when cancel is clicked', async () => {
      const user = userEvent.setup();

      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel booking' }));

      await waitFor(() => {
        expect(
          screen.getByText('Cancel booking', { selector: '[role="dialog"] *' }),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Are you sure you want to cancel booking ORD-001/),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keep booking' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yes, cancel' })).toBeInTheDocument();
    });

    it('calls cancel API when confirmed', async () => {
      const user = userEvent.setup();

      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));
      mockDelete.mockResolvedValue({
        data: { data: { ...mockBookingDetail, status: 'CANCELLED' } },
      });

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel booking' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Yes, cancel' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/api/v1/bookings/{id}', {
          params: { path: { id: 'bk_1' } },
        });
      });
    });
  });

  describe('pagination', () => {
    it('shows load more button when more pages are available', async () => {
      const bookings = [createBooking()];

      mockGet.mockResolvedValue(
        mockBookingsResponse(bookings, { total: 20, page: 1, pageSize: 10, totalPages: 2 }),
      );

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
      });
    });

    it('does not show load more when all items are loaded', async () => {
      mockGet.mockResolvedValue(
        mockBookingsResponse([createBooking()], { total: 1, page: 1, pageSize: 10, totalPages: 1 }),
      );

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByText('Berlin → Prague')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });
  });

  describe('booking categorization', () => {
    it('puts confirmed future bookings in upcoming', async () => {
      const futureBooking = createBooking({ tripDate: '2099-12-31T08:00:00Z' });

      mockGet.mockResolvedValue(mockBookingsResponse([futureBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        const upcomingTab = screen.getByRole('tab', { name: /upcoming/i });
        expect(within(upcomingTab).getByText('1')).toBeInTheDocument();
      });
    });

    it('puts completed bookings in past', async () => {
      const completedBooking = createBooking({
        id: 'bk_3',
        status: 'COMPLETED',
        tripDate: '2024-06-15T08:00:00Z',
      });

      mockGet.mockResolvedValue(mockBookingsResponse([completedBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        const pastTab = screen.getByRole('tab', { name: /past/i });
        expect(within(pastTab).getByText('1')).toBeInTheDocument();
      });

      const upcomingTab = screen.getByRole('tab', { name: /upcoming/i });
      expect(within(upcomingTab).getByText('0')).toBeInTheDocument();
    });

    it('puts cancelled bookings in past', async () => {
      const cancelledBooking = createBooking({
        id: 'bk_4',
        status: 'CANCELLED',
        tripDate: '2099-12-31T08:00:00Z',
      });

      mockGet.mockResolvedValue(mockBookingsResponse([cancelledBooking]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        const pastTab = screen.getByRole('tab', { name: /past/i });
        expect(within(pastTab).getByText('1')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has a page heading', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      expect(screen.getByRole('heading', { level: 1, name: 'My trips' })).toBeInTheDocument();
    });

    it('has accessible tablist', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('tablist', { name: 'Trip categories' })).toBeInTheDocument();
      });
    });

    it('booking list has accessible label', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Upcoming bookings')).toBeInTheDocument();
      });
    });

    it('empty state has status role', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('error state has alert role', async () => {
      mockGet.mockRejectedValue(new Error('fail'));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('expand button has correct aria-expanded attribute', async () => {
      mockGet.mockResolvedValue(mockBookingsResponse([createBooking()]));

      renderWithProviders(<MyTripsPage />, {
        routerProps: { initialEntries: ['/my-trips'] },
      });

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Expand details' });
        expect(btn).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });
});
