import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { components } from '@/api/generated/types';

type Seat = components['schemas']['Seat'];
type SeatType = components['schemas']['SeatType'];

/** Ordered list of seat types for cycling. */
const SEAT_TYPE_CYCLE: readonly SeatType[] = [
  'STANDARD',
  'PREMIUM',
  'DISABLED_ACCESSIBLE',
  'BLOCKED',
] as const;

/** Returns the translated label for a seat type. */
function getSeatTypeLabel(type: SeatType, t: TFunction): string {
  const keyMap: Record<SeatType, string> = {
    STANDARD: 'fleet.seatMapEditor.seatTypes.standard',
    PREMIUM: 'fleet.seatMapEditor.seatTypes.premium',
    DISABLED_ACCESSIBLE: 'fleet.seatMapEditor.seatTypes.accessible',
    BLOCKED: 'fleet.seatMapEditor.seatTypes.blocked',
  };
  return t(keyMap[type]);
}

/** Style configuration for each seat type in the editor. */
const SEAT_TYPE_STYLES: Record<SeatType, string> = {
  STANDARD: 'bg-green-100 border-green-400 text-green-800 hover:bg-green-200',
  PREMIUM: 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200 ring-2 ring-amber-400',
  DISABLED_ACCESSIBLE: 'bg-blue-100 border-blue-400 text-blue-800 hover:bg-blue-200',
  BLOCKED: 'bg-gray-200 border-gray-400 text-gray-700 hover:bg-gray-300',
};

/** Icons/symbols for seat types. */
const SEAT_TYPE_ICONS: Record<SeatType, string> = {
  STANDARD: '',
  PREMIUM: '\u2605', // ★
  DISABLED_ACCESSIBLE: '\u267F', // ♿
  BLOCKED: '\u2715', // ✕
};

/** Toolbar button styles for the active brush type. */
const BRUSH_STYLES: Record<SeatType, string> = {
  STANDARD: 'bg-green-100 border-green-400 text-green-800',
  PREMIUM: 'bg-amber-100 border-amber-400 text-amber-800',
  DISABLED_ACCESSIBLE: 'bg-blue-100 border-blue-400 text-blue-800',
  BLOCKED: 'bg-gray-200 border-gray-400 text-gray-700',
};

/** Props for the {@link SeatMapEditor} component. */
export interface SeatMapEditorProps {
  /** Array of seats to edit (from bus detail API). */
  seats: Seat[];
  /** Number of rows in the bus layout. */
  rows: number;
  /** Number of columns in the bus layout. */
  columns: number;
  /** Callback when user saves the modified seat layout. Receives the full updated seats array. */
  onSave: (seats: Seat[]) => void;
  /** Callback when user cancels editing. */
  onCancel: () => void;
  /** Whether a save operation is currently in progress. */
  isSaving?: boolean;
}

/**
 * Returns the next seat type in the cycle order.
 * @param current - Current seat type
 * @returns Next seat type in the cycle
 */
function getNextSeatType(current: SeatType): SeatType {
  const idx = SEAT_TYPE_CYCLE.indexOf(current);
  return SEAT_TYPE_CYCLE[(idx + 1) % SEAT_TYPE_CYCLE.length];
}

/**
 * Interactive seat map editor for modifying seat types in a bus layout.
 *
 * Provides two interaction modes:
 * - **Click** on a seat to cycle its type (Standard -> Premium -> Accessible -> Blocked)
 * - **Brush mode**: select a seat type from the toolbar, then click seats to paint them
 *
 * Displays a live seat count summary and supports full keyboard navigation.
 *
 * @example
 * ```tsx
 * <SeatMapEditor
 *   seats={busDetail.seats}
 *   rows={busDetail.rows}
 *   columns={busDetail.columns}
 *   onSave={(seats) => updateBus.mutate({ seats })}
 *   onCancel={() => setEditing(false)}
 * />
 * ```
 */
export const SeatMapEditor = memo(function SeatMapEditor({
  seats: initialSeats,
  rows,
  columns,
  onSave,
  onCancel,
  isSaving = false,
}: SeatMapEditorProps) {
  const { t } = useTranslation('provider');
  const [editedSeats, setEditedSeats] = useState<Seat[]>(() => initialSeats.map((s) => ({ ...s })));
  const [brushType, setBrushType] = useState<SeatType | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const seatGrid = useMemo(() => {
    const map = new Map<string, Seat>();
    for (const seat of editedSeats) {
      map.set(`${seat.row}-${seat.column}`, seat);
    }
    return map;
  }, [editedSeats]);

  const counts = useMemo(() => {
    const c: Record<SeatType, number> = {
      STANDARD: 0,
      PREMIUM: 0,
      DISABLED_ACCESSIBLE: 0,
      BLOCKED: 0,
    };
    for (const seat of editedSeats) {
      c[seat.type]++;
    }
    return c;
  }, [editedSeats]);

  const hasChanges = useMemo(() => {
    if (editedSeats.length !== initialSeats.length) return true;
    const initialMap = new Map(initialSeats.map((s) => [s.id, s.type]));
    return editedSeats.some((s) => initialMap.get(s.id) !== s.type);
  }, [editedSeats, initialSeats]);

  const updateSeatType = useCallback((seatId: string, newType: SeatType) => {
    setEditedSeats((prev) => prev.map((s) => (s.id === seatId ? { ...s, type: newType } : s)));
  }, []);

  const handleSeatClick = useCallback(
    (seat: Seat) => {
      if (brushType) {
        updateSeatType(seat.id, brushType);
      } else {
        updateSeatType(seat.id, getNextSeatType(seat.type));
      }
    },
    [brushType, updateSeatType],
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
          nextRow = Math.min(rows, row + 1);
          break;
        case 'ArrowLeft':
          nextCol = Math.max(1, col - 1);
          break;
        case 'ArrowRight':
          nextCol = Math.min(columns, col + 1);
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const seat = seatGrid.get(`${row}-${col}`);
          if (seat) handleSeatClick(seat);
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
    [rows, columns, seatGrid, handleSeatClick],
  );

  const handleSave = useCallback(() => {
    onSave(editedSeats);
  }, [editedSeats, onSave]);

  const rowArray = Array.from({ length: rows }, (_, i) => i + 1);
  const colArray = Array.from({ length: columns }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <BrushToolbar activeBrush={brushType} onBrushChange={setBrushType} />

      <TooltipProvider delayDuration={200}>
        <div ref={gridRef} role="grid" aria-label={t('fleet.seatMapEditor.gridLabel')} className="inline-block">
          {rowArray.map((row) => (
            <div key={row} role="row" className="flex">
              {colArray.map((col) => {
                const seat = seatGrid.get(`${row}-${col}`);
                if (!seat) {
                  return (
                    <div key={col} role="gridcell" className="m-1 h-10 w-10" aria-hidden="true" />
                  );
                }
                return (
                  <EditorSeatCell
                    key={col}
                    seat={seat}
                    onClick={() => handleSeatClick(seat)}
                    onKeyDown={(e) => handleKeyDown(e, row, col)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </TooltipProvider>

      <SeatCountSummary counts={counts} />

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? t('fleet.seatMapEditor.saving') : t('fleet.seatMapEditor.saveChanges')}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
});

/* ---------- Brush Toolbar ---------- */

/** Props for {@link BrushToolbar}. */
interface BrushToolbarProps {
  /** Currently active brush type, or null for cycle mode. */
  activeBrush: SeatType | null;
  /** Callback when brush changes. Pass null to switch to cycle mode. */
  onBrushChange: (type: SeatType | null) => void;
}

/**
 * Toolbar for selecting the active seat type brush.
 * Includes a "Cycle" button for the default click-to-cycle behavior.
 */
function BrushToolbar({ activeBrush, onBrushChange }: BrushToolbarProps) {
  const { t } = useTranslation('provider');

  return (
    <div role="radiogroup" aria-label={t('fleet.seatMapEditor.brushLabel')} className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={activeBrush === null ? 'default' : 'outline'}
        size="sm"
        role="radio"
        aria-checked={activeBrush === null}
        onClick={() => onBrushChange(null)}
      >
        {t('fleet.seatMapEditor.cycle')}
      </Button>
      {SEAT_TYPE_CYCLE.map((type) => (
        <Button
          key={type}
          type="button"
          variant="outline"
          size="sm"
          role="radio"
          aria-checked={activeBrush === type}
          className={cn(activeBrush === type && BRUSH_STYLES[type])}
          onClick={() => onBrushChange(type)}
        >
          {SEAT_TYPE_ICONS[type] && (
            <span className="mr-1" aria-hidden="true">
              {SEAT_TYPE_ICONS[type]}
            </span>
          )}
          {getSeatTypeLabel(type, t)}
        </Button>
      ))}
    </div>
  );
}

/* ---------- Editor Seat Cell ---------- */

/** Props for {@link EditorSeatCell}. */
interface EditorSeatCellProps {
  /** Seat data to render. */
  seat: Seat;
  /** Click handler for type modification. */
  onClick: () => void;
  /** Keyboard handler for grid navigation. */
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Individual seat cell within the seat map editor grid.
 * Displays the seat label with type-specific styling and tooltip.
 */
const EditorSeatCell = memo(function EditorSeatCell({
  seat,
  onClick,
  onKeyDown,
}: EditorSeatCellProps) {
  const { t } = useTranslation('provider');
  const icon = SEAT_TYPE_ICONS[seat.type];
  const translatedType = getSeatTypeLabel(seat.type, t);
  const ariaLabel = t('fleet.seatMapEditor.seatAriaLabel', { label: seat.label, type: translatedType });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="gridcell"
          aria-label={ariaLabel}
          data-row={seat.row}
          data-col={seat.column}
          tabIndex={seat.row === 1 && seat.column === 1 ? 0 : -1}
          className={cn(
            'm-1 flex h-10 w-10 items-center justify-center rounded border text-xs font-medium transition-colors',
            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            SEAT_TYPE_STYLES[seat.type],
          )}
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          {icon || seat.label}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {t('fleet.seatMapEditor.seatTooltip', { label: seat.label, type: translatedType })}
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

/* ---------- Seat Count Summary ---------- */

/** Props for {@link SeatCountSummary}. */
interface SeatCountSummaryProps {
  /** Count of seats per type. */
  counts: Record<SeatType, number>;
}

/**
 * Displays a summary of seat counts by type.
 */
function SeatCountSummary({ counts }: SeatCountSummaryProps) {
  const { t } = useTranslation('provider');
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div aria-label={t('fleet.seatMapEditor.countSummary')} className="flex flex-wrap gap-4 text-sm">
      <span className="font-medium">{t('fleet.seatMapEditor.total', { count: total })}</span>
      {SEAT_TYPE_CYCLE.map((type) => (
        <span key={type} className="text-muted-foreground">
          {counts[type]} {getSeatTypeLabel(type, t).toLowerCase()}
        </span>
      ))}
    </div>
  );
}
