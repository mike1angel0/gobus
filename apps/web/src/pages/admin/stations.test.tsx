import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import AdminStationsPage from './stations';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockAdminStations = vi.fn();
const mockCreateStation = vi.fn();
const mockUpdateStation = vi.fn();
const mockDeactivateStation = vi.fn();

vi.mock('@/hooks/use-stations', () => ({
  useAdminStations: (...args: unknown[]) => mockAdminStations(...args),
  useCreateStation: () => mockCreateStation(),
  useUpdateStation: () => mockUpdateStation(),
  useDeactivateStation: () => mockDeactivateStation(),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded state for the useAdminStations hook. */
function loadedState(stations: unknown[] = [], meta?: Record<string, unknown>) {
  return {
    data: {
      data: stations,
      meta: meta ?? { total: stations.length, page: 1, pageSize: 20, totalPages: 1 },
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

/** Returns a default idle mutation. */
function idleMutation() {
  return { mutate: vi.fn(), isPending: false };
}

/** Creates a mock station. */
function createMockStation(
  id: string,
  name: string,
  cityName: string,
  type: string = 'STATION',
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    name,
    cityName,
    type,
    address: 'Str. Test 1',
    lat: 44.45,
    lng: 26.07,
    facilities: [],
    phone: null,
    email: null,
    platformCount: null,
    isActive: true,
    createdBy: 'admin',
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-03-20T10:00:00Z',
    ...overrides,
  };
}

/* ---------- Tests ---------- */

describe('AdminStationsPage', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
    mockAdminStations.mockReset();
    mockCreateStation.mockReset();
    mockUpdateStation.mockReset();
    mockDeactivateStation.mockReset();
    mockCreateStation.mockReturnValue(idleMutation());
    mockUpdateStation.mockReturnValue(idleMutation());
    mockDeactivateStation.mockReturnValue(idleMutation());
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockAdminStations.mockReturnValue(loadingState());

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByLabelText('Loading stations')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error state when query fails', () => {
      mockAdminStations.mockReturnValue(errorState());

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockAdminStations.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<AdminStationsPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('renders empty state when no stations exist', () => {
      mockAdminStations.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByText('No stations found')).toBeInTheDocument();
    });
  });

  describe('loaded state', () => {
    it('renders station cards with names and types', () => {
      const stations = [
        createMockStation('s1', 'Autogara Nord', 'București', 'HUB'),
        createMockStation('s2', 'Gara de Sud', 'Cluj-Napoca', 'STATION'),
      ];
      mockAdminStations.mockReturnValue(loadedState(stations));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByText('Autogara Nord')).toBeInTheDocument();
      expect(screen.getByText('Gara de Sud')).toBeInTheDocument();
    });

    it('groups stations by city', () => {
      const stations = [
        createMockStation('s1', 'Autogara Nord', 'București', 'HUB'),
        createMockStation('s2', 'Autogara Sud', 'București', 'STATION'),
        createMockStation('s3', 'Gara Centrală', 'Cluj-Napoca', 'STATION'),
      ];
      mockAdminStations.mockReturnValue(loadedState(stations));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByText('București')).toBeInTheDocument();
      expect(screen.getByText('Cluj-Napoca')).toBeInTheDocument();
    });

    it('renders station address', () => {
      const stations = [
        createMockStation('s1', 'Autogara Nord', 'București', 'HUB', {
          address: 'Bd. Dinicu Golescu 1',
        }),
      ];
      mockAdminStations.mockReturnValue(loadedState(stations));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByText('Bd. Dinicu Golescu 1')).toBeInTheDocument();
    });

    it('shows facility icons when present', () => {
      const stations = [
        createMockStation('s1', 'Autogara Nord', 'București', 'HUB', {
          facilities: ['WIFI', 'PARKING'],
        }),
      ];
      mockAdminStations.mockReturnValue(loadedState(stations));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByText('WiFi')).toBeInTheDocument();
      expect(screen.getByText('Parking')).toBeInTheDocument();
    });

    it('shows inactive badge for deactivated stations', () => {
      const stations = [
        createMockStation('s1', 'Old Station', 'București', 'STOP', { isActive: false }),
      ];
      mockAdminStations.mockReturnValue(loadedState(stations));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('shows add station button', () => {
      mockAdminStations.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByRole('button', { name: /Add Station/ })).toBeInTheDocument();
    });

    it('opens create dialog when add button is clicked', async () => {
      const user = userEvent.setup();
      mockAdminStations.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminStationsPage />);

      await user.click(screen.getByRole('button', { name: /Add Station/ }));

      expect(screen.getByRole('heading', { name: 'Create Station' })).toBeInTheDocument();
    });

    it('opens deactivate confirmation when deactivate is clicked', async () => {
      const user = userEvent.setup();
      const stations = [createMockStation('s1', 'Test Station', 'București')];
      mockAdminStations.mockReturnValue(loadedState(stations));

      renderWithProviders(<AdminStationsPage />);

      await user.click(screen.getByRole('button', { name: 'Deactivate' }));

      expect(screen.getByText('Deactivate station?')).toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('renders filter controls', () => {
      mockAdminStations.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByLabelText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText('City')).toBeInTheDocument();
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when multiple pages exist', () => {
      const stations = [createMockStation('s1', 'Test', 'București')];
      mockAdminStations.mockReturnValue(
        loadedState(stations, { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    it('hides pagination when single page', () => {
      const stations = [createMockStation('s1', 'Test', 'București')];
      mockAdminStations.mockReturnValue(loadedState(stations));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockAdminStations.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Station Management');
    });

    it('filter bar has search landmark role', () => {
      mockAdminStations.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminStationsPage />);

      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const stations = [createMockStation('s1', 'Test', 'București')];
      mockAdminStations.mockReturnValue(loadedState(stations));

      const { container } = renderWithProviders(<AdminStationsPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});
