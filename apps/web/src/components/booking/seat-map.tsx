import { useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { components } from '@/api/generated/types';

type SeatAvailability = components['schemas']['SeatAvailability'];

/**
 * Visual state of a seat in the seat map, derived from API data and user selection.
 * - available: can be clicked to select
 * - selected: currently selected by the user
 * - occupied: already booked by another passenger
 * - blocked: seat is blocked (type BLOCKED)
 * - disabled: seat is not enabled for booking
 */
type SeatState = 'available' | 'selected' | 'occupied' | 'blocked' | 'disabled';

/** Props for the {@link SeatMap} component. */
export interface SeatMapProps {
  /** Array of seats with availability data from the trip detail API. */
  seats: SeatAvailability[];
  /** IDs of currently selected seats. */
  selectedSeatIds: string[];
  /** Callback fired when seat selection changes. Receives the updated array of selected seat IDs. */
  onSelectionChange: (seatIds: string[]) => void;
  /** Column number after which to render an aisle gap. Defaults to 2 for 4-column buses. */
  aisleAfterColumn?: number;
  /** Base price for the trip, used when a seat has price 0. */
  basePrice: number;
}

/** Style configuration for each seat state. */
const SEAT_STYLES: Record<SeatState, string> = {
  available:
    'bg-green-100 border-green-400 text-green-800 hover:bg-green-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring',
  selected:
    'bg-blue-500 border-blue-600 text-white hover:bg-blue-600 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring',
  occupied: 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed',
  blocked: 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed',
  disabled: 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed',
};

/** Human-readable labels for seat states, used in the legend. */
const STATE_LABELS: Record<SeatState, string> = {
  available: 'Available',
  selected: 'Selected',
  occupied: 'Occupied',
  blocked: 'Blocked',
  disabled: 'Disabled',
};

/** Human-readable labels for seat types. */
const TYPE_LABELS: Record<SeatAvailability['type'], string> = {
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
  DISABLED_ACCESSIBLE: 'Accessible',
  BLOCKED: 'Blocked',
};

/**
 * Derives the visual state of a seat from its API data and current selection.
 * @param seat - Seat availability data from the API
 * @param isSelected - Whether the seat is currently selected by the user
 * @returns The visual state to render
 */
function getSeatState(seat: SeatAvailability, isSelected: boolean): SeatState {
  if (seat.type === 'BLOCKED') return 'blocked';
  if (seat.isBooked) return 'occupied';
  if (!seat.isEnabled) return 'disabled';
  if (isSelected) return 'selected';
  return 'available';
}

/**
 * Returns the effective price for a seat, falling back to basePrice when the seat price is 0.
 * @param seat - Seat availability data
 * @param basePrice - Trip base price fallback
 * @returns The display price for the seat
 */
function getEffectivePrice(seat: SeatAvailability, basePrice: number): number {
  return seat.price > 0 ? seat.price : basePrice;
}

/**
 * Formats a price as a currency string.
 * @param price - Numeric price value
 * @returns Formatted price string (e.g., "$12.50")
 */
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Builds an accessible label for a seat describing its label, type, state, and price.
 * @param seat - Seat availability data
 * @param state - Current visual state of the seat
 * @param price - Effective price to display
 * @returns Descriptive string for screen readers
 */
function buildSeatAriaLabel(seat: SeatAvailability, state: SeatState, price: number): string {
  const parts = [`Seat ${seat.label}`, TYPE_LABELS[seat.type]];
  if (state === 'available' || state === 'selected') {
    parts.push(formatPrice(price));
  }
  parts.push(STATE_LABELS[state]);
  return parts.join(', ');
}

/**
 * Interactive bus seat map grid for selecting seats during booking.
 *
 * Renders seats in a grid layout based on row/column data from the API.
 * Supports all seat states (available, selected, occupied, blocked, disabled),
 * premium seat highlighting, aisle gaps, keyboard navigation, and tooltips.
 *
 * @example
 * ```tsx
 * <SeatMap
 *   seats={tripDetail.seats}
 *   selectedSeatIds={selected}
 *   onSelectionChange={setSelected}
 *   basePrice={tripDetail.basePrice}
 * />
 * ```
 */
export function SeatMap({
  seats,
  selectedSeatIds,
  onSelectionChange,
  aisleAfterColumn = 2,
  basePrice,
}: SeatMapProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedSeatIds), [selectedSeatIds]);

  const { grid, maxRow, maxCol } = useMemo(() => {
    const seatGrid = new Map<string, SeatAvailability>();
    let mr = 0;
    let mc = 0;
    for (const seat of seats) {
      seatGrid.set(`${seat.row}-${seat.column}`, seat);
      if (seat.row > mr) mr = seat.row;
      if (seat.column > mc) mc = seat.column;
    }
    return { grid: seatGrid, maxRow: mr, maxCol: mc };
  }, [seats]);

  const toggleSeat = useCallback(
    (seat: SeatAvailability) => {
      const state = getSeatState(seat, selectedSet.has(seat.id));
      if (state !== 'available' && state !== 'selected') return;

      if (selectedSet.has(seat.id)) {
        onSelectionChange(selectedSeatIds.filter((id) => id !== seat.id));
      } else {
        onSelectionChange([...selectedSeatIds, seat.id]);
      }
    },
    [selectedSeatIds, selectedSet, onSelectionChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      let nextRow = row;
      let nextCol = col;

      switch (e.key) {
        case 'ArrowUp':
          nextRow = Math.max(1, row - 1);
          break;
        case 'ArrowDown':
          nextRow = Math.min(maxRow, row + 1);
          break;
        case 'ArrowLeft':
          nextCol = Math.max(1, col - 1);
          break;
        case 'ArrowRight':
          nextCol = Math.min(maxCol, col + 1);
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const seat = grid.get(`${row}-${col}`);
          if (seat) toggleSeat(seat);
          return;
        }
        default:
          return;
      }

      e.preventDefault();
      const target = gridRef.current?.querySelector<HTMLElement>(
        `[data-row="${nextRow}"][data-col="${nextCol}"]`,
      );
      target?.focus();
    },
    [maxRow, maxCol, grid, toggleSeat],
  );

  if (seats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No seats available for this trip.
      </p>
    );
  }

  const rows = Array.from({ length: maxRow }, (_, i) => i + 1);
  const cols = Array.from({ length: maxCol }, (_, i) => i + 1);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div ref={gridRef} role="grid" aria-label="Seat map" className="inline-block">
          {rows.map((row) => (
            <div key={row} role="row" className="flex">
              {cols.map((col) => {
                const seat = grid.get(`${row}-${col}`);
                const isAisleGap = col === aisleAfterColumn && col < maxCol;

                return (
                  <div key={col} className={cn('flex', isAisleGap && 'mr-4')}>
                    {seat ? (
                      <SeatCell
                        seat={seat}
                        isSelected={selectedSet.has(seat.id)}
                        basePrice={basePrice}
                        onClick={() => toggleSeat(seat)}
                        onKeyDown={(e) => handleKeyDown(e, row, col)}
                      />
                    ) : (
                      <div role="gridcell" className="m-1 h-10 w-10" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <SeatLegend />
      </div>
    </TooltipProvider>
  );
}

/** Props for the {@link SeatCell} component. */
interface SeatCellProps {
  /** Seat availability data from the API. */
  seat: SeatAvailability;
  /** Whether this seat is currently selected. */
  isSelected: boolean;
  /** Base price fallback when seat price is 0. */
  basePrice: number;
  /** Click handler for toggling selection. */
  onClick: () => void;
  /** Keyboard handler for grid navigation. */
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Individual seat cell within the seat map grid.
 * Renders the seat with appropriate styling, state indicators, and tooltip.
 */
function SeatCell({ seat, isSelected, basePrice, onClick, onKeyDown }: SeatCellProps) {
  const state = getSeatState(seat, isSelected);
  const effectivePrice = getEffectivePrice(seat, basePrice);
  const ariaLabel = buildSeatAriaLabel(seat, state, effectivePrice);
  const isInteractive = state === 'available' || state === 'selected';
  const isPremium = seat.type === 'PREMIUM';

  const tooltipText = `${seat.label} · ${TYPE_LABELS[seat.type]} · ${formatPrice(effectivePrice)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="gridcell"
          aria-label={ariaLabel}
          aria-selected={isSelected}
          aria-disabled={!isInteractive}
          data-row={seat.row}
          data-col={seat.column}
          tabIndex={seat.row === 1 && seat.column === 1 ? 0 : -1}
          className={cn(
            'm-1 flex h-10 w-10 items-center justify-center rounded border text-xs font-medium transition-colors',
            'focus-visible:outline-none',
            SEAT_STYLES[state],
            isPremium && state !== 'occupied' && 'ring-2 ring-amber-400',
          )}
          onClick={isInteractive ? onClick : undefined}
          onKeyDown={onKeyDown}
          disabled={!isInteractive}
        >
          {state === 'blocked' && '✕'}
          {state === 'disabled' && '⊘'}
          {state !== 'blocked' && state !== 'disabled' && seat.label}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Legend showing all seat state and type indicators used in the seat map.
 */
function SeatLegend() {
  const items: Array<{ label: string; className: string; content: string }> = [
    { label: 'Available', className: SEAT_STYLES.available, content: '' },
    { label: 'Selected', className: SEAT_STYLES.selected, content: '' },
    { label: 'Occupied', className: SEAT_STYLES.occupied, content: '' },
    {
      label: 'Blocked',
      className: SEAT_STYLES.blocked,
      content: '✕',
    },
    {
      label: 'Disabled',
      className: SEAT_STYLES.disabled,
      content: '⊘',
    },
    {
      label: 'Premium',
      className: cn(SEAT_STYLES.available, 'ring-2 ring-amber-400'),
      content: '',
    },
  ];

  return (
    <div role="group" aria-label="Seat map legend" className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded border text-[10px] font-medium',
              item.className,
            )}
            aria-hidden="true"
          >
            {item.content}
          </span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
