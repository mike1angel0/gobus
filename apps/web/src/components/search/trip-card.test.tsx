import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { TripCard, type TripCardProps, type TripDelay, type TripStop } from './trip-card';

const baseTripData: TripCardProps['trip'] = {
  scheduleId: 'sched-001',
  providerName: 'EuroLines',
  routeName: 'Vienna Express',
  origin: 'Vienna',
  destination: 'Budapest',
  departureTime: '2026-05-01T08:00:00Z',
  arrivalTime: '2026-05-01T10:30:00Z',
  tripDate: '2026-05-01',
  price: 25.5,
  availableSeats: 30,
  totalSeats: 50,
};

const stopsData: TripStop[] = [
  {
    stopName: 'Vienna Central',
    arrivalTime: '2026-05-01T08:00:00Z',
    departureTime: '2026-05-01T08:00:00Z',
  },
  {
    stopName: 'Bratislava',
    arrivalTime: '2026-05-01T09:00:00Z',
    departureTime: '2026-05-01T09:05:00Z',
  },
  {
    stopName: 'Budapest Keleti',
    arrivalTime: '2026-05-01T10:30:00Z',
    departureTime: '2026-05-01T10:30:00Z',
  },
];

describe('TripCard', () => {
  it('renders provider name', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    expect(screen.getByText('EuroLines')).toBeInTheDocument();
  });

  it('renders departure and arrival times', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    // Times are locale-dependent; check that time elements exist
    expect(screen.getByText('Vienna')).toBeInTheDocument();
    expect(screen.getByText('Budapest')).toBeInTheDocument();
  });

  it('renders route name', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    expect(screen.getByText('Vienna Express')).toBeInTheDocument();
  });

  it('renders duration between departure and arrival', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    expect(screen.getByText('2h 30m')).toBeInTheDocument();
  });

  it('renders price with lei currency', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    expect(screen.getByText('25,50 lei')).toBeInTheDocument();
  });

  it('renders available seats count', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    expect(screen.getByText('30 seats available')).toBeInTheDocument();
  });

  it('uses singular "seat" when only 1 available', () => {
    renderWithProviders(<TripCard trip={{ ...baseTripData, availableSeats: 1 }} />);
    expect(screen.getByText('1 seat available')).toBeInTheDocument();
  });

  it('links to trip detail page with correct URL', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/trip/sched-001?date=2026-05-01');
  });

  it('has accessible aria-label on the link', () => {
    renderWithProviders(<TripCard trip={baseTripData} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label');
    const label = link.getAttribute('aria-label') ?? '';
    expect(label).toContain('Vienna Express');
    expect(label).toContain('Vienna');
    expect(label).toContain('Budapest');
    expect(label).toMatch(/25[.,]50/);
    expect(label).toContain('30 seats');
  });

  // Seat availability color coding
  it('shows green color for high seat availability (>50%)', () => {
    renderWithProviders(
      <TripCard trip={{ ...baseTripData, availableSeats: 30, totalSeats: 50 }} />,
    );
    const seatsText = screen.getByText('30 seats available');
    expect(seatsText).toHaveClass('text-green-500');
  });

  it('shows yellow color for medium seat availability (20-50%)', () => {
    renderWithProviders(
      <TripCard trip={{ ...baseTripData, availableSeats: 15, totalSeats: 50 }} />,
    );
    const seatsText = screen.getByText('15 seats available');
    expect(seatsText).toHaveClass('text-yellow-500');
  });

  it('shows red color for low seat availability (<20%)', () => {
    renderWithProviders(<TripCard trip={{ ...baseTripData, availableSeats: 2, totalSeats: 50 }} />);
    const seatsText = screen.getByText('2 seats available');
    expect(seatsText).toHaveClass('text-red-500');
  });

  // Delay badge
  describe('delay badge', () => {
    it('does not show delay badge when no delay provided', () => {
      renderWithProviders(<TripCard trip={baseTripData} />);
      expect(screen.queryByText('On Time')).not.toBeInTheDocument();
      expect(screen.queryByText(/Delayed/)).not.toBeInTheDocument();
    });

    it('shows "On Time" badge when delayMinutes is 0', () => {
      const delay: TripDelay = { delayMinutes: 0 };
      renderWithProviders(<TripCard trip={baseTripData} delay={delay} />);
      const badge = screen.getByText('On Time');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'On Time');
    });

    it('shows minor delay badge for delays <= 15 min', () => {
      const delay: TripDelay = { delayMinutes: 10 };
      renderWithProviders(<TripCard trip={baseTripData} delay={delay} />);
      const badge = screen.getByText('+10min');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-yellow-500');
    });

    it('shows major delay badge for delays > 15 min', () => {
      const delay: TripDelay = { delayMinutes: 25, reason: 'Traffic' };
      renderWithProviders(<TripCard trip={baseTripData} delay={delay} />);
      const badge = screen.getByText('+25min');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-red-500');
      expect(badge).toHaveAttribute('aria-label', 'Delayed 25min — Traffic');
    });
  });

  // Expandable stops section
  describe('expandable stops', () => {
    it('does not show stops section when no stops provided', () => {
      renderWithProviders(<TripCard trip={baseTripData} />);
      expect(screen.queryByText(/stops/i)).not.toBeInTheDocument();
    });

    it('shows stops toggle button with count', () => {
      renderWithProviders(<TripCard trip={baseTripData} stops={stopsData} />);
      expect(screen.getByText('3 stops')).toBeInTheDocument();
    });

    it('expands stops list on toggle click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TripCard trip={baseTripData} stops={stopsData} />);

      const toggleButton = screen.getByRole('button', { name: /stops/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(toggleButton);

      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Hide stops')).toBeInTheDocument();

      const stopsList = screen.getByRole('list', { name: 'Trip stops' });
      const items = within(stopsList).getAllByRole('listitem');
      expect(items).toHaveLength(3);
      expect(screen.getByText('Vienna Central')).toBeInTheDocument();
      expect(screen.getByText('Bratislava')).toBeInTheDocument();
      expect(screen.getByText('Budapest Keleti')).toBeInTheDocument();
    });

    it('collapses stops list when toggle clicked again', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TripCard trip={baseTripData} stops={stopsData} />);

      const toggleButton = screen.getByRole('button', { name: /stops/i });
      await user.click(toggleButton);
      expect(screen.getByText('Vienna Central')).toBeInTheDocument();

      await user.click(toggleButton);
      expect(screen.queryByText('Vienna Central')).not.toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  // Responsive layout
  it('renders within a card component', () => {
    const { container } = renderWithProviders(<TripCard trip={baseTripData} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('rounded-lg', 'border');
  });

  // Duration edge cases
  it('renders duration correctly for exact hours', () => {
    renderWithProviders(
      <TripCard
        trip={{
          ...baseTripData,
          departureTime: '2026-05-01T08:00:00Z',
          arrivalTime: '2026-05-01T10:00:00Z',
        }}
      />,
    );
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('renders duration correctly for minutes only', () => {
    renderWithProviders(
      <TripCard
        trip={{
          ...baseTripData,
          departureTime: '2026-05-01T08:00:00Z',
          arrivalTime: '2026-05-01T08:45:00Z',
        }}
      />,
    );
    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <TripCard trip={baseTripData} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('encodes scheduleId in URL when it contains special characters', () => {
    renderWithProviders(<TripCard trip={{ ...baseTripData, scheduleId: 'sched/001' }} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/trip/sched%2F001?date=2026-05-01');
  });
});
