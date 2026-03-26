import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SeatMapEditor, type SeatMapEditorProps } from './seat-map-editor';
import { renderWithProviders } from '@/test/helpers';
import type { components } from '@/api/generated/types';

type Seat = components['schemas']['Seat'];


/* ---------- Helpers ---------- */

/** Creates a mock seat with defaults. */
function makeSeat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: 'seat_1',
    row: 1,
    column: 1,
    label: '1A',
    type: 'STANDARD',
    price: 0,
    isEnabled: true,
    ...overrides,
  };
}

/** Creates a 2x2 grid of seats. */
function makeGrid(): Seat[] {
  return [
    makeSeat({ id: 'seat_1', row: 1, column: 1, label: '1A', type: 'STANDARD' }),
    makeSeat({ id: 'seat_2', row: 1, column: 2, label: '1B', type: 'PREMIUM' }),
    makeSeat({ id: 'seat_3', row: 2, column: 1, label: '2A', type: 'DISABLED_ACCESSIBLE' }),
    makeSeat({ id: 'seat_4', row: 2, column: 2, label: '2B', type: 'BLOCKED' }),
  ];
}

/** Default props for SeatMapEditor. */
function defaultProps(overrides: Partial<SeatMapEditorProps> = {}): SeatMapEditorProps {
  return {
    seats: makeGrid(),
    rows: 2,
    columns: 2,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isSaving: false,
    ...overrides,
  };
}

/** Renders the SeatMapEditor with providers. */
function renderEditor(overrides: Partial<SeatMapEditorProps> = {}) {
  return renderWithProviders(<SeatMapEditor {...defaultProps(overrides)} />);
}

/* ---------- Tests ---------- */

describe('SeatMapEditor', () => {
  describe('rendering', () => {
    it('renders all seats in the grid', () => {
      renderEditor();

      const grid = screen.getByRole('grid', { name: 'Seat map editor' });
      expect(grid).toBeInTheDocument();

      // Each seat has an aria-label with its label
      expect(screen.getByLabelText(/Seat 1A/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Seat 1B/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Seat 2A/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Seat 2B/)).toBeInTheDocument();
    });

    it('shows visual distinction for each seat type', () => {
      renderEditor();

      // Standard seat shows its label
      const standardSeat = screen.getByLabelText(/Seat 1A, Standard/);
      expect(standardSeat).toHaveTextContent('1A');

      // Premium seat shows star icon
      const premiumSeat = screen.getByLabelText(/Seat 1B, Premium/);
      expect(premiumSeat).toHaveTextContent('\u2605');

      // Accessible seat shows wheelchair icon
      const accessibleSeat = screen.getByLabelText(/Seat 2A, Accessible/);
      expect(accessibleSeat).toHaveTextContent('\u267F');

      // Blocked seat shows X icon
      const blockedSeat = screen.getByLabelText(/Seat 2B, Blocked/);
      expect(blockedSeat).toHaveTextContent('\u2715');
    });

    it('shows seat count summary', () => {
      renderEditor();

      const summary = screen.getByLabelText('Seat count summary');
      expect(summary).toHaveTextContent('4 total');
      expect(summary).toHaveTextContent('1 standard');
      expect(summary).toHaveTextContent('1 premium');
      expect(summary).toHaveTextContent('1 accessible');
      expect(summary).toHaveTextContent('1 blocked');
    });

    it('renders brush toolbar with all type options', () => {
      renderEditor();

      const toolbar = screen.getByRole('radiogroup', { name: 'Seat type brush' });
      expect(toolbar).toBeInTheDocument();

      expect(within(toolbar).getByRole('radio', { name: 'Cycle' })).toBeInTheDocument();
      expect(within(toolbar).getByRole('radio', { name: /Standard/ })).toBeInTheDocument();
      expect(within(toolbar).getByRole('radio', { name: /Premium/ })).toBeInTheDocument();
      expect(within(toolbar).getByRole('radio', { name: /Accessible/ })).toBeInTheDocument();
      expect(within(toolbar).getByRole('radio', { name: /Blocked/ })).toBeInTheDocument();
    });

    it('renders save and cancel buttons', () => {
      renderEditor();

      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('disables save button when no changes are made', () => {
      renderEditor();

      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });
  });

  describe('click to cycle seat type', () => {
    it('cycles STANDARD to PREMIUM on click', async () => {
      const user = userEvent.setup();
      renderEditor();

      const seat = screen.getByLabelText(/Seat 1A, Standard/);
      await user.click(seat);

      // After cycling, the seat should now be Premium
      expect(screen.getByLabelText(/Seat 1A, Premium/)).toBeInTheDocument();
    });

    it('cycles PREMIUM to ACCESSIBLE on click', async () => {
      const user = userEvent.setup();
      renderEditor();

      const seat = screen.getByLabelText(/Seat 1B, Premium/);
      await user.click(seat);

      expect(screen.getByLabelText(/Seat 1B, Accessible/)).toBeInTheDocument();
    });

    it('cycles DISABLED_ACCESSIBLE to BLOCKED on click', async () => {
      const user = userEvent.setup();
      renderEditor();

      const seat = screen.getByLabelText(/Seat 2A, Accessible/);
      await user.click(seat);

      expect(screen.getByLabelText(/Seat 2A, Blocked/)).toBeInTheDocument();
    });

    it('cycles BLOCKED back to STANDARD on click', async () => {
      const user = userEvent.setup();
      renderEditor();

      const seat = screen.getByLabelText(/Seat 2B, Blocked/);
      await user.click(seat);

      expect(screen.getByLabelText(/Seat 2B, Standard/)).toBeInTheDocument();
    });

    it('updates seat count summary after cycling', async () => {
      const user = userEvent.setup();
      renderEditor();

      // Click standard seat to make it premium → now 0 standard, 2 premium
      await user.click(screen.getByLabelText(/Seat 1A, Standard/));

      const summary = screen.getByLabelText('Seat count summary');
      expect(summary).toHaveTextContent('0 standard');
      expect(summary).toHaveTextContent('2 premium');
    });
  });

  describe('brush mode', () => {
    it('paints seats with selected brush type', async () => {
      const user = userEvent.setup();
      renderEditor();

      // Select Premium brush
      await user.click(screen.getByRole('radio', { name: /Premium/ }));

      // Click a standard seat — should become premium (not cycle)
      await user.click(screen.getByLabelText(/Seat 1A, Standard/));

      expect(screen.getByLabelText(/Seat 1A, Premium/)).toBeInTheDocument();
    });

    it('shows active brush in toolbar', async () => {
      const user = userEvent.setup();
      renderEditor();

      const premiumRadio = screen.getByRole('radio', { name: /Premium/ });
      expect(premiumRadio).toHaveAttribute('aria-checked', 'false');

      await user.click(premiumRadio);

      expect(premiumRadio).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: 'Cycle' })).toHaveAttribute('aria-checked', 'false');
    });

    it('switches back to cycle mode', async () => {
      const user = userEvent.setup();
      renderEditor();

      // Select brush
      await user.click(screen.getByRole('radio', { name: /Blocked/ }));
      // Switch back to cycle
      await user.click(screen.getByRole('radio', { name: 'Cycle' }));

      expect(screen.getByRole('radio', { name: 'Cycle' })).toHaveAttribute('aria-checked', 'true');

      // Click standard seat → should cycle to premium (not set to blocked)
      await user.click(screen.getByLabelText(/Seat 1A, Standard/));
      expect(screen.getByLabelText(/Seat 1A, Premium/)).toBeInTheDocument();
    });
  });

  describe('keyboard accessibility', () => {
    it('cycles seat type on Enter key', async () => {
      const user = userEvent.setup();
      renderEditor();

      const seat = screen.getByLabelText(/Seat 1A, Standard/);
      seat.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByLabelText(/Seat 1A, Premium/)).toBeInTheDocument();
    });

    it('cycles seat type on Space key', async () => {
      const user = userEvent.setup();
      renderEditor();

      const seat = screen.getByLabelText(/Seat 1A, Standard/);
      seat.focus();
      await user.keyboard(' ');

      expect(screen.getByLabelText(/Seat 1A, Premium/)).toBeInTheDocument();
    });

    it('navigates between seats with arrow keys', async () => {
      const user = userEvent.setup();
      renderEditor();

      const seat1A = screen.getByLabelText(/Seat 1A/);
      seat1A.focus();

      // Arrow right → 1B
      await user.keyboard('{ArrowRight}');
      expect(screen.getByLabelText(/Seat 1B/)).toHaveFocus();

      // Arrow down → 2B
      await user.keyboard('{ArrowDown}');
      expect(screen.getByLabelText(/Seat 2B/)).toHaveFocus();

      // Arrow left → 2A
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByLabelText(/Seat 2A/)).toHaveFocus();

      // Arrow up → 1A
      await user.keyboard('{ArrowUp}');
      expect(screen.getByLabelText(/Seat 1A/)).toHaveFocus();
    });

    it('first seat has tabIndex 0, others have -1', () => {
      renderEditor();

      const seat1A = screen.getByLabelText(/Seat 1A/);
      const seat1B = screen.getByLabelText(/Seat 1B/);
      const seat2A = screen.getByLabelText(/Seat 2A/);

      expect(seat1A).toHaveAttribute('tabindex', '0');
      expect(seat1B).toHaveAttribute('tabindex', '-1');
      expect(seat2A).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('save and cancel', () => {
    it('calls onSave with modified seats', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderEditor({ onSave });

      // Make a change first
      await user.click(screen.getByLabelText(/Seat 1A, Standard/));

      // Save button should now be enabled
      const saveBtn = screen.getByRole('button', { name: 'Save changes' });
      expect(saveBtn).toBeEnabled();

      await user.click(saveBtn);

      expect(onSave).toHaveBeenCalledTimes(1);
      const savedSeats = onSave.mock.calls[0][0] as Seat[];
      const changedSeat = savedSeats.find((s) => s.id === 'seat_1');
      expect(changedSeat?.type).toBe('PREMIUM');
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      renderEditor({ onCancel });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('shows saving state when isSaving is true', () => {
      renderEditor({ isSaving: true });

      expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('enables save button only after changes', async () => {
      const user = userEvent.setup();
      renderEditor();

      // Initially disabled
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

      // Make a change
      await user.click(screen.getByLabelText(/Seat 1A, Standard/));

      // Now enabled
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });
  });

  describe('accessibility', () => {
    it('grid has proper aria-label', () => {
      renderEditor();
      expect(screen.getByRole('grid', { name: 'Seat map editor' })).toBeInTheDocument();
    });

    it('brush toolbar has proper radiogroup role', () => {
      renderEditor();
      expect(screen.getByRole('radiogroup', { name: 'Seat type brush' })).toBeInTheDocument();
    });

    it('seats have descriptive aria-labels', () => {
      renderEditor();

      expect(screen.getByLabelText('Seat 1A, Standard. Click to change type.')).toBeInTheDocument();
      expect(screen.getByLabelText('Seat 1B, Premium. Click to change type.')).toBeInTheDocument();
      expect(screen.getByLabelText('Seat 2A, Accessible. Click to change type.')).toBeInTheDocument();
      expect(screen.getByLabelText('Seat 2B, Blocked. Click to change type.')).toBeInTheDocument();
    });

    it('all seat buttons are interactive', () => {
      renderEditor();

      const gridcells = screen.getAllByRole('gridcell');
      const buttons = gridcells.filter((cell) => cell.tagName === 'BUTTON');
      expect(buttons).toHaveLength(4);
      buttons.forEach((btn) => {
        expect(btn).not.toBeDisabled();
      });
    });
  });
});
