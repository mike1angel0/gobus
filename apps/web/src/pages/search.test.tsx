import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchPage from './search';
import { renderWithProviders } from '@/test/helpers';

const mockGet = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTrips = [
  {
    scheduleId: 'sched_1',
    providerName: 'EuroBus',
    routeName: 'Berlin - Prague',
    origin: 'Berlin',
    destination: 'Prague',
    departureTime: '2026-04-01T08:00:00Z',
    arrivalTime: '2026-04-01T12:00:00Z',
    tripDate: '2026-04-01',
    price: 25.0,
    availableSeats: 30,
    totalSeats: 40,
  },
  {
    scheduleId: 'sched_2',
    providerName: 'CityLine',
    routeName: 'Berlin - Prague Express',
    origin: 'Berlin',
    destination: 'Prague',
    departureTime: '2026-04-01T14:00:00Z',
    arrivalTime: '2026-04-01T17:30:00Z',
    tripDate: '2026-04-01',
    price: 35.0,
    availableSeats: 5,
    totalSeats: 40,
  },
];

describe('SearchPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockNavigate.mockClear();
  });

  describe('loading state', () => {
    it('renders skeleton cards while loading', () => {
      mockGet.mockReturnValue(new Promise(() => {})); // never resolves

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      const loadingRegion = screen.getByLabelText('Loading search results');
      expect(loadingRegion).toHaveAttribute('aria-busy', 'true');
    });

    it('does not render a spinner', () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('results state', () => {
    it('renders TripCard for each result', async () => {
      mockGet.mockResolvedValue({
        data: { data: mockTrips, meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 } },
      });

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('2 trips found')).toBeInTheDocument();
      });

      expect(screen.getByText('EuroBus')).toBeInTheDocument();
      expect(screen.getByText('CityLine')).toBeInTheDocument();
    });

    it('displays correct trip count for single result', async () => {
      mockGet.mockResolvedValue({
        data: { data: [mockTrips[0]], meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 } },
      });

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('1 trip found')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('renders empty state when no results', async () => {
      mockGet.mockResolvedValue({
        data: { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } },
      });

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('No trips found')).toBeInTheDocument();
      });

      expect(screen.getByText(/couldn't find any trips matching your search/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error state with retry button on failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('retries the search when retry button is clicked', async () => {
      const user = userEvent.setup();

      mockGet.mockRejectedValueOnce(new Error('Network error'));
      mockGet.mockResolvedValueOnce({
        data: { data: mockTrips, meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 } },
      });

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => {
        expect(screen.getByText('2 trips found')).toBeInTheDocument();
      });
    });
  });

  describe('no params state', () => {
    it('shows prompt when no search params are provided', () => {
      renderWithProviders(<SearchPage />, {
        routerProps: { initialEntries: ['/search'] },
      });

      expect(screen.getByText('Search for trips')).toBeInTheDocument();
      expect(
        screen.getByText(/enter your origin, destination, and travel date/i),
      ).toBeInTheDocument();
    });
  });

  describe('search form', () => {
    it('renders the search form in full mode', () => {
      renderWithProviders(<SearchPage />, {
        routerProps: { initialEntries: ['/search'] },
      });

      expect(screen.getByRole('search', { name: 'Search trips' })).toBeInTheDocument();
    });

    it('pre-fills the search form from query params', () => {
      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      expect(screen.getByLabelText('Origin')).toHaveValue('Berlin');
      expect(screen.getByLabelText('Destination')).toHaveValue('Prague');
      expect(screen.getByLabelText('Travel date')).toHaveValue('2026-04-01');
    });
  });

  describe('auto-refetch on param changes', () => {
    it('calls the API with correct query params', async () => {
      mockGet.mockResolvedValue({
        data: { data: mockTrips, meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 } },
      });

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/v1/search', {
          params: {
            query: {
              origin: 'Berlin',
              destination: 'Prague',
              date: '2026-04-01',
              page: undefined,
              pageSize: undefined,
            },
          },
        });
      });
    });
  });

  describe('accessibility', () => {
    it('has a page heading', () => {
      renderWithProviders(<SearchPage />, {
        routerProps: { initialEntries: ['/search'] },
      });

      expect(screen.getByRole('heading', { level: 1, name: 'Search trips' })).toBeInTheDocument();
    });

    it('results list has accessible label', async () => {
      mockGet.mockResolvedValue({
        data: { data: mockTrips, meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 } },
      });

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Search results')).toBeInTheDocument();
      });
    });

    it('empty state has status role', async () => {
      mockGet.mockResolvedValue({
        data: { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } },
      });

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('error state has alert role', async () => {
      mockGet.mockRejectedValue(new Error('fail'));

      renderWithProviders(<SearchPage />, {
        routerProps: {
          initialEntries: ['/search?origin=Berlin&destination=Prague&date=2026-04-01'],
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
