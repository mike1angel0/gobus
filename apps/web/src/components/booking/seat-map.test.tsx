import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { SeatMap, type SeatMapProps } from './seat-map';
import type { components } from '@/api/generated/types';

type SeatAvailability = components['schemas']['SeatAvailability'];

/** Creates a seat with sensible defaults for testing. */
function makeSeat(overrides: Partial<SeatAvailability> = {}): SeatAvailability {
  return {
    id: 'seat-1',
    row: 1,
    column: 1,
    label: '1A',
    type: 'STANDARD',
    price: 0,
    isEnabled: true,
    isBooked: false,
    ...overrides,
  };
}

/** Creates a 2x2 seat grid for testing. */
function makeGrid(): SeatAvailability[] {
  return [
    makeSeat({ id: 's1', row: 1, column: 1, label: '1A' }),
    makeSeat({ id: 's2', row: 1, column: 2, label: '1B' }),
    makeSeat({ id: 's3', row: 2, column: 1, label: '2A' }),
    makeSeat({ id: 's4', row: 2, column: 2, label: '2B' }),
  ];
}

function renderSeatMap(overrides: Partial<SeatMapProps> = {}) {
  const props: SeatMapProps = {
    seats: makeGrid(),
    selectedSeatIds: [],
    onSelectionChange: vi.fn(),
    basePrice: 10,
    ...overrides,
  };
  return { ...renderWithProviders(<SeatMap {...props} />), props };
}

describe('SeatMap', () => {
  it('renders grid with correct number of seats', () => {
    renderSeatMap();
    const grid = screen.getByRole('grid', { name: 'Seat map' });
    expect(grid).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(4);
  });

  it('renders seat labels', () => {
    renderSeatMap();
    expect(screen.getByText('1A')).toBeInTheDocument();
    expect(screen.getByText('1B')).toBeInTheDocument();
    expect(screen.getByText('2A')).toBeInTheDocument();
    expect(screen.getByText('2B')).toBeInTheDocument();
  });

  it('shows empty state when no seats provided', () => {
    renderSeatMap({ seats: [] });
    expect(screen.getByText('No seats available for this trip.')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('renders legend with all seat types', () => {
    renderSeatMap();
    const legend = screen.getByRole('group', { name: 'Seat map legend' });
    expect(legend).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('Occupied')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  describe('seat states', () => {
    it('renders available seats as enabled buttons', () => {
      renderSeatMap();
      const seatBtn = screen.getByRole('gridcell', { name: /Seat 1A/ });
      expect(seatBtn).toBeEnabled();
      expect(seatBtn).toHaveAttribute('aria-disabled', 'false');
    });

    it('renders selected seats with aria-selected', () => {
      renderSeatMap({ selectedSeatIds: ['s1'] });
      const seatBtn = screen.getByRole('gridcell', { name: /Seat 1A.*Selected/ });
      expect(seatBtn).toHaveAttribute('aria-selected', 'true');
    });

    it('renders occupied seats as disabled', () => {
      const seats = [makeSeat({ id: 's1', isBooked: true })];
      renderSeatMap({ seats });
      const seatBtn = screen.getByRole('gridcell', { name: /Seat 1A.*Occupied/ });
      expect(seatBtn).toBeDisabled();
    });

    it('renders blocked seats with X mark', () => {
      const seats = [makeSeat({ id: 's1', type: 'BLOCKED' })];
      renderSeatMap({ seats });
      const seatBtn = screen.getByRole('gridcell', { name: /Seat 1A.*Blocked/ });
      expect(seatBtn).toBeDisabled();
      expect(seatBtn).toHaveTextContent('✕');
    });

    it('renders disabled seats with ⊘ mark', () => {
      const seats = [makeSeat({ id: 's1', isEnabled: false })];
      renderSeatMap({ seats });
      const seatBtn = screen.getByRole('gridcell', { name: /Seat 1A.*Disabled/ });
      expect(seatBtn).toBeDisabled();
      expect(seatBtn).toHaveTextContent('⊘');
    });

    it('renders premium seats with gold ring', () => {
      const seats = [makeSeat({ id: 's1', type: 'PREMIUM', price: 25 })];
      renderSeatMap({ seats });
      const seatBtn = screen.getByRole('gridcell', { name: /Seat 1A.*Premium/ });
      expect(seatBtn.className).toContain('ring-amber-400');
    });
  });

  describe('selection', () => {
    it('calls onSelectionChange with seat id when clicking available seat', async () => {
      const user = userEvent.setup();
      const { props } = renderSeatMap();
      const seat = screen.getByRole('gridcell', { name: /Seat 1A/ });
      await user.click(seat);
      expect(props.onSelectionChange).toHaveBeenCalledWith(['s1']);
    });

    it('removes seat id when clicking selected seat', async () => {
      const user = userEvent.setup();
      const { props } = renderSeatMap({ selectedSeatIds: ['s1', 's2'] });
      const seat = screen.getByRole('gridcell', { name: /Seat 1A.*Selected/ });
      await user.click(seat);
      expect(props.onSelectionChange).toHaveBeenCalledWith(['s2']);
    });

    it('does not call onSelectionChange when clicking occupied seat', async () => {
      const user = userEvent.setup();
      const seats = [makeSeat({ id: 's1', isBooked: true })];
      const { props } = renderSeatMap({ seats });
      const seat = screen.getByRole('gridcell', { name: /Seat 1A.*Occupied/ });
      await user.click(seat);
      expect(props.onSelectionChange).not.toHaveBeenCalled();
    });

    it('does not call onSelectionChange when clicking blocked seat', async () => {
      const user = userEvent.setup();
      const seats = [makeSeat({ id: 's1', type: 'BLOCKED' })];
      const { props } = renderSeatMap({ seats });
      const seat = screen.getByRole('gridcell', { name: /Seat 1A.*Blocked/ });
      await user.click(seat);
      expect(props.onSelectionChange).not.toHaveBeenCalled();
    });

    it('does not call onSelectionChange when clicking disabled seat', async () => {
      const user = userEvent.setup();
      const seats = [makeSeat({ id: 's1', isEnabled: false })];
      const { props } = renderSeatMap({ seats });
      const seat = screen.getByRole('gridcell', { name: /Seat 1A.*Disabled/ });
      await user.click(seat);
      expect(props.onSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('moves focus with arrow keys', async () => {
      const user = userEvent.setup();
      renderSeatMap();
      const seat1A = screen.getByRole('gridcell', { name: /Seat 1A/ });
      seat1A.focus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('gridcell', { name: /Seat 1B/ })).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('gridcell', { name: /Seat 2B/ })).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('gridcell', { name: /Seat 2A/ })).toHaveFocus();

      await user.keyboard('{ArrowUp}');
      expect(screen.getByRole('gridcell', { name: /Seat 1A/ })).toHaveFocus();
    });

    it('selects seat with Enter key', async () => {
      const user = userEvent.setup();
      const { props } = renderSeatMap();
      const seat1A = screen.getByRole('gridcell', { name: /Seat 1A/ });
      seat1A.focus();

      await user.keyboard('{Enter}');
      expect(props.onSelectionChange).toHaveBeenCalledWith(['s1']);
    });

    it('selects seat with Space key', async () => {
      const user = userEvent.setup();
      const { props } = renderSeatMap();
      const seat1A = screen.getByRole('gridcell', { name: /Seat 1A/ });
      seat1A.focus();

      await user.keyboard(' ');
      expect(props.onSelectionChange).toHaveBeenCalledWith(['s1']);
    });
  });

  describe('aisle gap', () => {
    it('renders aisle gap after specified column', () => {
      const seats = [
        makeSeat({ id: 's1', row: 1, column: 1, label: '1A' }),
        makeSeat({ id: 's2', row: 1, column: 2, label: '1B' }),
        makeSeat({ id: 's3', row: 1, column: 3, label: '1C' }),
        makeSeat({ id: 's4', row: 1, column: 4, label: '1D' }),
      ];
      const { container } = renderSeatMap({ seats, aisleAfterColumn: 2 });
      const aisleGapElements = container.querySelectorAll('.mr-4');
      expect(aisleGapElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('pricing', () => {
    it('uses seat price in aria-label when seat has override price', () => {
      const seats = [makeSeat({ id: 's1', price: 25 })];
      renderSeatMap({ seats, basePrice: 10 });
      const seat = screen.getByRole('gridcell', { name: /\$25\.00/ });
      expect(seat).toBeInTheDocument();
    });

    it('uses base price in aria-label when seat price is 0', () => {
      const seats = [makeSeat({ id: 's1', price: 0 })];
      renderSeatMap({ seats, basePrice: 10 });
      const seat = screen.getByRole('gridcell', { name: /\$10\.00/ });
      expect(seat).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role=grid on the container', () => {
      renderSeatMap();
      expect(screen.getByRole('grid', { name: 'Seat map' })).toBeInTheDocument();
    });

    it('each seat has aria-label with label, type, state, and price', () => {
      renderSeatMap();
      const seat = screen.getByRole('gridcell', { name: /Seat 1A/ });
      expect(seat).toHaveAttribute(
        'aria-label',
        'Seat 1A, Standard, $10.00, Available',
      );
    });

    it('seats have role=gridcell', () => {
      renderSeatMap();
      const gridcells = screen.getAllByRole('gridcell');
      expect(gridcells.length).toBe(4);
    });

    it('rows have role=row', () => {
      renderSeatMap();
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(2);
    });

    it('legend has role=group with aria-label', () => {
      renderSeatMap();
      expect(screen.getByRole('group', { name: 'Seat map legend' })).toBeInTheDocument();
    });
  });

  describe('grid layout', () => {
    it('handles gaps in seat grid (missing seats)', () => {
      const seats = [
        makeSeat({ id: 's1', row: 1, column: 1, label: '1A' }),
        makeSeat({ id: 's3', row: 2, column: 2, label: '2B' }),
      ];
      renderSeatMap({ seats });
      // 2 seat buttons visible, empty cells are aria-hidden
      const gridcells = screen.getAllByRole('gridcell');
      expect(gridcells).toHaveLength(2);
      expect(screen.getByText('1A')).toBeInTheDocument();
      expect(screen.getByText('2B')).toBeInTheDocument();
    });
  });
});
