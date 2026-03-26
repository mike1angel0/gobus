import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/helpers';
import { PassengerList, type PassengerListProps } from './passenger-list';
import type { components } from '@/api/generated/types';

type DriverTripPassenger = components['schemas']['DriverTripPassenger'];

function createPassenger(overrides: Partial<DriverTripPassenger> = {}): DriverTripPassenger {
  return {
    bookingId: 'bk_1',
    passengerName: 'Alice Smith',
    boardingStop: 'Bucharest North',
    alightingStop: 'Cluj Central',
    seatLabels: ['1A', '1B'],
    status: 'CONFIRMED',
    ...overrides,
  };
}

function renderPassengerList(overrides: Partial<PassengerListProps> = {}) {
  const defaultProps: PassengerListProps = {
    passengers: undefined,
    totalSeats: 40,
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    ...overrides,
  };
  return renderWithProviders(<PassengerList {...defaultProps} />);
}

describe('PassengerList', () => {
  describe('loading state', () => {
    it('renders loading skeleton when isLoading is true', () => {
      renderPassengerList({ isLoading: true });

      expect(screen.getByLabelText('Loading passengers')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading passengers')).toHaveAttribute('aria-busy', 'true');
    });

    it('does not render passenger list during loading', () => {
      renderPassengerList({ isLoading: true });

      expect(screen.queryByLabelText('Passenger list')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error message when isError is true', () => {
      renderPassengerList({ isError: true });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load passenger list')).toBeInTheDocument();
    });

    it('calls onRetry when Try again is clicked', async () => {
      const onRetry = vi.fn();
      renderPassengerList({ isError: true, onRetry });

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe('empty state', () => {
    it('renders empty state when passengers is undefined', () => {
      renderPassengerList({ passengers: undefined });

      expect(screen.getByText('No passengers booked for this trip')).toBeInTheDocument();
    });

    it('renders empty state when passengers array is empty', () => {
      renderPassengerList({ passengers: [] });

      expect(screen.getByText('No passengers booked for this trip')).toBeInTheDocument();
    });
  });

  describe('passenger rendering', () => {
    it('renders passenger name, stops, seats, and status', () => {
      const passenger = createPassenger();
      renderPassengerList({ passengers: [passenger] });

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bucharest North → Cluj Central')).toBeInTheDocument();
      expect(screen.getByText('Seats: 1A, 1B')).toBeInTheDocument();
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    });

    it('renders multiple passengers', () => {
      const passengers = [
        createPassenger({ bookingId: 'bk_1', passengerName: 'Alice Smith' }),
        createPassenger({
          bookingId: 'bk_2',
          passengerName: 'Bob Jones',
          boardingStop: 'Pitesti',
          seatLabels: ['3C'],
          status: 'CANCELLED',
        }),
      ];
      renderPassengerList({ passengers });

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('shows cancelled passenger with destructive badge', () => {
      const passenger = createPassenger({ status: 'CANCELLED' });
      renderPassengerList({ passengers: [passenger] });

      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });

    it('hides seats line when seatLabels is empty', () => {
      const passenger = createPassenger({ seatLabels: [] });
      renderPassengerList({ passengers: [passenger] });

      expect(screen.queryByText(/Seats:/)).not.toBeInTheDocument();
    });

    it('shows passengers with different stops', () => {
      const passengers = [
        createPassenger({
          bookingId: 'bk_1',
          boardingStop: 'Stop A',
          alightingStop: 'Stop C',
        }),
        createPassenger({
          bookingId: 'bk_2',
          passengerName: 'Bob',
          boardingStop: 'Stop B',
          alightingStop: 'Stop D',
        }),
      ];
      renderPassengerList({ passengers });

      expect(screen.getByText('Stop A → Stop C')).toBeInTheDocument();
      expect(screen.getByText('Stop B → Stop D')).toBeInTheDocument();
    });
  });

  describe('count header', () => {
    it('shows confirmed count and total seats', () => {
      const passengers = [
        createPassenger({ bookingId: 'bk_1', status: 'CONFIRMED' }),
        createPassenger({ bookingId: 'bk_2', status: 'CANCELLED' }),
        createPassenger({ bookingId: 'bk_3', passengerName: 'Charlie', status: 'CONFIRMED' }),
      ];
      renderPassengerList({ passengers, totalSeats: 40 });

      expect(screen.getByText('(2 / 40)')).toBeInTheDocument();
    });

    it('does not show count during loading', () => {
      renderPassengerList({ isLoading: true, totalSeats: 40 });

      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('renders passenger list with proper aria-label', () => {
      const passengers = [createPassenger()];
      renderPassengerList({ passengers });

      expect(screen.getByRole('list', { name: 'Passenger list' })).toBeInTheDocument();
    });

    it('has heading for passengers section', () => {
      renderPassengerList({ passengers: [createPassenger()] });

      expect(screen.getByText('Passengers')).toBeInTheDocument();
    });
  });
});
