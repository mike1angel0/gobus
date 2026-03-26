import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminFleetPage from './fleet';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockAdminBuses = vi.fn();
const mockToggleSeat = vi.fn();
const mockBusDetail = vi.fn();

vi.mock('@/hooks/use-admin', () => ({
  useAdminBuses: (...args: unknown[]) => mockAdminBuses(...args),
  useToggleSeat: () => mockToggleSeat(),
}));

vi.mock('@/hooks/use-buses', () => ({
  useBusDetail: (...args: unknown[]) => mockBusDetail(...args),
}));

vi.mock('@/components/fleet/create-bus-dialog', () => ({
  SeatGridPreview: ({ rows, columns }: { rows: number; columns: number }) => (
    <div aria-label={`${rows} rows, ${columns} columns seat layout`} />
  ),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded state for the useAdminBuses hook. */
function loadedState(buses: unknown[] = [], meta?: Record<string, unknown>) {
  return {
    data: {
      data: buses,
      meta: meta ?? { total: buses.length, page: 1, pageSize: 20, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns a loading state. */
function loadingState() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns an error state. */
function errorState() {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  };
}

/** Creates a mock bus. */
function createMockBus(
  id: string,
  licensePlate: string,
  model: string,
  providerId = 'prov_1',
) {
  return {
    id,
    licensePlate,
    model,
    capacity: 48,
    rows: 12,
    columns: 4,
    providerId,
    createdAt: '2026-03-20T10:00:00Z',
  };
}

/** Creates a mock seat. */
function createMockSeat(
  id: string,
  row: number,
  column: number,
  label: string,
  isEnabled = true,
  type = 'STANDARD' as const,
) {
  return { id, row, column, label, type, price: 0, isEnabled };
}

/** Returns a loaded bus detail state with seats. */
function busDetailLoaded(bus: Record<string, unknown>, seats: unknown[]) {
  return {
    data: { data: { ...bus, seats } },
    isLoading: false,
    isError: false,
  };
}

/** Returns a loading bus detail state. */
function busDetailLoading() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
  };
}

/** Returns an error bus detail state. */
function busDetailError() {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
  };
}

/** Returns a default idle mutation. */
function idleMutation() {
  return { mutate: vi.fn(), isPending: false };
}

/* ---------- Tests ---------- */

describe('AdminFleetPage', () => {
  beforeEach(() => {
    mockAdminBuses.mockReset();
    mockToggleSeat.mockReset();
    mockBusDetail.mockReset();
    mockToggleSeat.mockReturnValue(idleMutation());
    mockBusDetail.mockReturnValue(busDetailLoading());
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockAdminBuses.mockReturnValue(loadingState());

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByLabelText('Loading fleet')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('error state', () => {
    it('renders error state when query fails', () => {
      mockAdminBuses.mockReturnValue(errorState());

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load fleet')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockAdminBuses.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('renders empty state when no buses exist', () => {
      mockAdminBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByText('No buses found')).toBeInTheDocument();
      expect(
        screen.getByText('No buses have been registered by any provider yet.'),
      ).toBeInTheDocument();
    });
  });

  describe('loaded state', () => {
    it('renders bus cards with license plates and models', () => {
      const buses = [
        createMockBus('bus_1', 'AB-123-CD', 'Mercedes Tourismo'),
        createMockBus('bus_2', 'EF-456-GH', 'Volvo 9700'),
      ];
      mockAdminBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByText('AB-123-CD')).toBeInTheDocument();
      expect(screen.getByText('EF-456-GH')).toBeInTheDocument();
      expect(screen.getByText('Mercedes Tourismo')).toBeInTheDocument();
      expect(screen.getByText('Volvo 9700')).toBeInTheDocument();
    });

    it('renders bus capacity and dimensions', () => {
      const buses = [createMockBus('bus_1', 'AB-123-CD', 'Mercedes')];
      mockAdminBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByText('48 seats · 12×4')).toBeInTheDocument();
    });

    it('groups buses by provider', () => {
      const buses = [
        createMockBus('bus_1', 'AB-123', 'Mercedes', 'prov_alpha'),
        createMockBus('bus_2', 'CD-456', 'Volvo', 'prov_beta'),
        createMockBus('bus_3', 'EF-789', 'Scania', 'prov_alpha'),
      ];
      mockAdminBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByText('Provider: prov_alpha')).toBeInTheDocument();
      expect(screen.getByText('Provider: prov_beta')).toBeInTheDocument();

      // Alpha provider group should have 2 buses
      const alphaGroup = screen.getByLabelText('Buses for provider prov_alpha');
      expect(within(alphaGroup).getByText('AB-123')).toBeInTheDocument();
      expect(within(alphaGroup).getByText('EF-789')).toBeInTheDocument();

      // Beta provider group should have 1 bus
      const betaGroup = screen.getByLabelText('Buses for provider prov_beta');
      expect(within(betaGroup).getByText('CD-456')).toBeInTheDocument();
    });

    it('shows seat grid preview when collapsed', () => {
      const buses = [createMockBus('bus_1', 'AB-123', 'Mercedes')];
      mockAdminBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByLabelText('12 rows, 4 columns seat layout')).toBeInTheDocument();
    });
  });

  describe('seat management', () => {
    it('expands seat grid when manage seats is clicked', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [
        createMockSeat('s1', 0, 0, '1A', true),
        createMockSeat('s2', 0, 1, '1B', false),
      ];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      const manageBtn = screen.getByRole('button', { name: /Manage seats for AB-123/ });
      await user.click(manageBtn);

      expect(screen.getByRole('grid', { name: 'Seat toggle grid' })).toBeInTheDocument();
    });

    it('shows loading skeleton for seats while fetching', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      mockBusDetail.mockReturnValue(busDetailLoading());

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));

      expect(screen.getByLabelText('Loading seats')).toHaveAttribute('aria-busy', 'true');
    });

    it('shows error when seat loading fails', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      mockBusDetail.mockReturnValue(busDetailError());

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));

      expect(screen.getByText('Failed to load seats.')).toBeInTheDocument();
    });

    it('renders enabled and disabled seats with distinct styles', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [
        createMockSeat('s1', 0, 0, '1A', true),
        createMockSeat('s2', 0, 1, '1B', false),
      ];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));

      expect(
        screen.getByRole('gridcell', { name: /Seat 1A.*enabled.*Click to disable/ }),
      ).toBeInTheDocument();

      const disabledSeat = screen.getByRole('gridcell', {
        name: /Seat 1B.*disabled.*Click to enable/,
      });
      expect(disabledSeat).toHaveClass('line-through');
    });

    it('shows enabled/disabled count summary', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [
        createMockSeat('s1', 0, 0, '1A', true),
        createMockSeat('s2', 0, 1, '1B', true),
        createMockSeat('s3', 0, 2, '1C', false),
      ];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));

      expect(screen.getByText('2 enabled · 1 disabled')).toBeInTheDocument();
    });

    it('calls toggleSeat mutation when seat is clicked', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockToggleSeat.mockReturnValue({ mutate: mutateFn, isPending: false });
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [createMockSeat('s1', 0, 0, '1A', true)];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));
      await user.click(
        screen.getByRole('gridcell', { name: /Seat 1A.*enabled.*Click to disable/ }),
      );

      expect(mutateFn).toHaveBeenCalledWith({ id: 's1', isEnabled: false });
    });

    it('calls toggleSeat to enable a disabled seat', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockToggleSeat.mockReturnValue({ mutate: mutateFn, isPending: false });
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [createMockSeat('s1', 0, 0, '1A', false)];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));
      await user.click(
        screen.getByRole('gridcell', { name: /Seat 1A.*disabled.*Click to enable/ }),
      );

      expect(mutateFn).toHaveBeenCalledWith({ id: 's1', isEnabled: true });
    });

    it('collapses seat grid when collapse button is clicked', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [createMockSeat('s1', 0, 0, '1A', true)];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      // Expand
      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));
      expect(screen.getByRole('grid', { name: 'Seat toggle grid' })).toBeInTheDocument();

      // Collapse
      await user.click(screen.getByRole('button', { name: /Collapse seats for AB-123/ }));
      expect(screen.queryByRole('grid', { name: 'Seat toggle grid' })).not.toBeInTheDocument();
    });

    it('hides seat grid preview when expanded', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [createMockSeat('s1', 0, 0, '1A', true)];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      // Preview visible when collapsed
      expect(screen.getByLabelText('12 rows, 4 columns seat layout')).toBeInTheDocument();

      // Expand
      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));

      // Preview hidden when expanded
      expect(screen.queryByLabelText('12 rows, 4 columns seat layout')).not.toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when multiple pages exist', () => {
      const buses = [createMockBus('bus_1', 'AB-123', 'Mercedes')];
      mockAdminBuses.mockReturnValue(
        loadedState(buses, { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    it('navigates to next page', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123', 'Mercedes')];
      mockAdminBuses.mockReturnValue(
        loadedState(buses, { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: 'Next' }));

      // Should call with page 2
      expect(mockAdminBuses).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    });

    it('navigates to previous page', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123', 'Mercedes')];
      // Start on page 2
      mockAdminBuses.mockReturnValue(
        loadedState(buses, { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminFleetPage />);

      // Go to page 2 first
      await user.click(screen.getByRole('button', { name: 'Next' }));
      // Then go back
      await user.click(screen.getByRole('button', { name: 'Previous' }));

      expect(mockAdminBuses).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });
    });

    it('hides pagination when single page', () => {
      const buses = [createMockBus('bus_1', 'AB-123', 'Mercedes')];
      mockAdminBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<AdminFleetPage />);

      expect(screen.queryByRole('navigation', { name: 'Fleet pagination' })).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockAdminBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminFleetPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fleet Management');
      expect(
        screen.getByRole('heading', { level: 2, name: 'Admin Fleet' }),
      ).toBeInTheDocument();
    });

    it('uses landmark section with aria-labelledby', () => {
      mockAdminBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminFleetPage />);

      const section = screen.getByRole('region', { name: 'Admin Fleet' });
      expect(section).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const buses = [createMockBus('bus_1', 'AB-123', 'Mercedes')];
      mockAdminBuses.mockReturnValue(loadedState(buses));

      const { container } = renderWithProviders(<AdminFleetPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('manage seats buttons have aria-expanded', () => {
      const buses = [createMockBus('bus_1', 'AB-123', 'Mercedes')];
      mockAdminBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<AdminFleetPage />);

      const btn = screen.getByRole('button', { name: /Manage seats for AB-123/ });
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });

    it('seat buttons have descriptive aria-labels', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));
      const seats = [createMockSeat('s1', 0, 0, '1A', true, 'PREMIUM')];
      mockBusDetail.mockReturnValue(busDetailLoaded(bus, seats));

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));

      expect(
        screen.getByRole('gridcell', { name: /Seat 1A, premium, enabled/ }),
      ).toBeInTheDocument();
    });
  });

  describe('data fetching', () => {
    it('fetches buses with page 1 and pageSize 20', () => {
      mockAdminBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminFleetPage />);

      expect(mockAdminBuses).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    });

    it('fetches bus detail when seats are expanded', async () => {
      const user = userEvent.setup();
      const bus = createMockBus('bus_1', 'AB-123', 'Mercedes');
      mockAdminBuses.mockReturnValue(loadedState([bus]));

      renderWithProviders(<AdminFleetPage />);

      await user.click(screen.getByRole('button', { name: /Manage seats for AB-123/ }));

      expect(mockBusDetail).toHaveBeenCalledWith('bus_1');
    });
  });
});
