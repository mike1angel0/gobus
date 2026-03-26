import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import TripDetailPage from './[id]';
import { renderWithProviders } from '@/test/helpers';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/api/hooks', () => ({
  useApiClient: () => ({ GET: mockGet, POST: mockPost }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTripDetail = {
  scheduleId: 'sched_1',
  routeName: 'Berlin - Prague',
  providerName: 'EuroBus',
  departureTime: '2026-04-01T08:00:00Z',
  arrivalTime: '2026-04-01T12:00:00Z',
  tripDate: '2026-04-01',
  basePrice: 25.0,
  status: 'ACTIVE' as const,
  stopTimes: [
    {
      id: 'st_1',
      stopName: 'Berlin',
      arrivalTime: '2026-04-01T08:00:00Z',
      departureTime: '2026-04-01T08:00:00Z',
      orderIndex: 0,
      priceFromStart: 0,
    },
    {
      id: 'st_2',
      stopName: 'Dresden',
      arrivalTime: '2026-04-01T10:00:00Z',
      departureTime: '2026-04-01T10:15:00Z',
      orderIndex: 1,
      priceFromStart: 12.5,
    },
    {
      id: 'st_3',
      stopName: 'Prague',
      arrivalTime: '2026-04-01T12:00:00Z',
      departureTime: '2026-04-01T12:00:00Z',
      orderIndex: 2,
      priceFromStart: 25.0,
    },
  ],
  seats: [
    { id: 'seat_1', row: 1, column: 1, label: '1A', type: 'STANDARD' as const, price: 0, isEnabled: true, isBooked: false },
    { id: 'seat_2', row: 1, column: 2, label: '1B', type: 'STANDARD' as const, price: 0, isEnabled: true, isBooked: false },
    { id: 'seat_3', row: 1, column: 3, label: '1C', type: 'STANDARD' as const, price: 0, isEnabled: true, isBooked: true },
    { id: 'seat_4', row: 1, column: 4, label: '1D', type: 'STANDARD' as const, price: 0, isEnabled: true, isBooked: false },
  ],
};

function renderPage(url = '/trip/sched_1?date=2026-04-01') {
  return renderWithProviders(
    <Routes>
      <Route path="/trip/:id" element={<TripDetailPage />} />
    </Routes>,
    {
      routerProps: { initialEntries: [url] },
    },
  );
}

describe('TripDetailPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockNavigate.mockClear();
  });

  describe('loading state', () => {
    it('renders skeleton while loading', () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      renderPage();

      expect(screen.getByLabelText('Loading trip details')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('error state', () => {
    it('renders error state with retry button on failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('retries when retry button is clicked', async () => {
      const user = userEvent.setup();
      mockGet.mockRejectedValueOnce(new Error('fail'));
      mockGet.mockResolvedValueOnce({ data: { data: mockTripDetail } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => {
        expect(screen.getByText('Berlin - Prague')).toBeInTheDocument();
      });
    });
  });

  describe('trip info display', () => {
    it('displays route name and provider', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Berlin - Prague')).toBeInTheDocument();
      });

      expect(screen.getByText('EuroBus')).toBeInTheDocument();
    });

    it('displays departure and arrival labels', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Departure')).toBeInTheDocument();
      });

      expect(screen.getByText('Arrival')).toBeInTheDocument();
    });

    it('displays base price', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('From')).toBeInTheDocument();
      });

      // Base price appears next to "From" label
      const priceElements = screen.getAllByText('$25.00');
      expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays all stops in the stop list', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Trip stops')).toBeInTheDocument();
      });

      const stopList = screen.getByLabelText('Trip stops');
      expect(within(stopList).getByText('Berlin')).toBeInTheDocument();
      expect(within(stopList).getByText('Dresden')).toBeInTheDocument();
      expect(within(stopList).getByText('Prague')).toBeInTheDocument();
    });

    it('displays stop count', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Stops (3)')).toBeInTheDocument();
      });
    });

    it('shows cancelled badge for cancelled trips', async () => {
      const cancelledTrip = { ...mockTripDetail, status: 'CANCELLED' as const };
      mockGet.mockResolvedValue({ data: { data: cancelledTrip } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Cancelled')).toBeInTheDocument();
      });
    });

    it('hides booking form for cancelled trips', async () => {
      const cancelledTrip = { ...mockTripDetail, status: 'CANCELLED' as const };
      mockGet.mockResolvedValue({ data: { data: cancelledTrip } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Cancelled')).toBeInTheDocument();
      });

      expect(screen.queryByText('Book this trip')).not.toBeInTheDocument();
    });
  });

  describe('booking form', () => {
    it('renders booking form for active trips', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Book this trip')).toBeInTheDocument();
      });
    });

    it('renders boarding and alighting stop dropdowns', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Select alighting stop')).toBeInTheDocument();
    });

    it('disables alighting dropdown until boarding is selected', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select alighting stop')).toBeDisabled();
      });
    });

    it('enables alighting dropdown after boarding is selected', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Select boarding stop'), 'Berlin');

      expect(screen.getByLabelText('Select alighting stop')).not.toBeDisabled();
    });

    it('only shows stops after boarding as alighting options', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Select boarding stop'), 'Berlin');

      const alightingSelect = screen.getByLabelText('Select alighting stop');
      const options = within(alightingSelect).getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);

      expect(optionTexts).toContain('Dresden');
      expect(optionTexts).toContain('Prague');
      expect(optionTexts).not.toContain('Berlin');
    });

    it('boarding dropdown excludes the last stop', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
      });

      const boardingSelect = screen.getByLabelText('Select boarding stop');
      const options = within(boardingSelect).getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);

      expect(optionTexts).toContain('Berlin');
      expect(optionTexts).toContain('Dresden');
      expect(optionTexts).not.toContain('Prague');
    });

    it('renders seat map', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('grid', { name: 'Seat map' })).toBeInTheDocument();
      });
    });

    it('confirm button is disabled without selections', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Confirm booking')).toBeDisabled();
      });
    });
  });

  describe('booking flow', () => {
    it('computes and displays segment price', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Select boarding stop'), 'Berlin');
      await user.selectOptions(screen.getByLabelText('Select alighting stop'), 'Prague');

      const seat1A = screen.getByRole('gridcell', { name: /Seat 1A/i });
      await user.click(seat1A);

      await waitFor(() => {
        expect(screen.getByText('1 seat × $25.00')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Price summary')).toBeInTheDocument();
    });

    it('submits booking and redirects on success', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      mockPost.mockResolvedValue({
        data: { data: { id: 'bk_1', orderId: 'ORD-1', status: 'CONFIRMED' } },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Select boarding stop'), 'Berlin');
      await user.selectOptions(screen.getByLabelText('Select alighting stop'), 'Prague');

      const seat1A = screen.getByRole('gridcell', { name: /Seat 1A/i });
      await user.click(seat1A);

      await user.click(screen.getByLabelText('Confirm booking'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/v1/bookings', {
          body: {
            scheduleId: 'sched_1',
            seatLabels: ['1A'],
            boardingStop: 'Berlin',
            alightingStop: 'Prague',
            tripDate: '2026-04-01',
          },
        });
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/my-trips');
      });
    });

    it('enables confirm only when all fields filled', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Confirm booking')).toBeDisabled();
      });

      await user.selectOptions(screen.getByLabelText('Select boarding stop'), 'Berlin');
      expect(screen.getByLabelText('Confirm booking')).toBeDisabled();

      await user.selectOptions(screen.getByLabelText('Select alighting stop'), 'Prague');
      expect(screen.getByLabelText('Confirm booking')).toBeDisabled();

      const seat1A = screen.getByRole('gridcell', { name: /Seat 1A/i });
      await user.click(seat1A);

      expect(screen.getByLabelText('Confirm booking')).not.toBeDisabled();
    });

    it('resets alighting when boarding changes to later stop', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText('Select boarding stop'), 'Berlin');
      await user.selectOptions(screen.getByLabelText('Select alighting stop'), 'Dresden');

      await user.selectOptions(screen.getByLabelText('Select boarding stop'), 'Dresden');

      expect(screen.getByLabelText('Select alighting stop')).toHaveValue('');
    });
  });

  describe('API call', () => {
    it('calls API with correct path and query params', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/v1/trips/{scheduleId}', {
          params: {
            path: { scheduleId: 'sched_1' },
            query: { tripDate: '2026-04-01' },
          },
        });
      });
    });
  });

  describe('accessibility', () => {
    it('has a page heading', () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      expect(screen.getByRole('heading', { level: 1, name: 'Trip Details' })).toBeInTheDocument();
    });

    it('has a back to search link', () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      const backLink = screen.getByText('Back to search');
      expect(backLink).toHaveAttribute('href', '/search');
    });

    it('stop list has accessible label', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Trip stops')).toBeInTheDocument();
      });
    });

    it('form labels are linked to inputs', async () => {
      mockGet.mockResolvedValue({ data: { data: mockTripDetail } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Select boarding stop')).toBeInTheDocument();
        expect(screen.getByLabelText('Select alighting stop')).toBeInTheDocument();
      });
    });
  });
});
