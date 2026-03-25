import type { BusTemplate, CreateSeatData, SeatType } from './bus.entity.js';

/**
 * Generate a column letter from a 1-based column index (1=A, 2=B, ...).
 * @param column - Column number (1-based).
 * @returns Column letter label.
 */
function columnLabel(column: number): string {
  return String.fromCharCode(64 + column);
}

/**
 * Generate a seat grid for a bus layout.
 * @param rows - Number of seat rows.
 * @param columns - Number of seat columns per row.
 * @param options - Optional seat type overrides.
 * @returns Array of seat data for the grid.
 */
function generateSeatGrid(
  rows: number,
  columns: number,
  options?: {
    premiumRows?: number[];
    accessibleSeats?: Array<{ row: number; column: number }>;
    blockedSeats?: Array<{ row: number; column: number }>;
  },
): CreateSeatData[] {
  const seats: CreateSeatData[] = [];
  const premiumRowSet = new Set(options?.premiumRows ?? []);
  const accessibleSet = new Set(
    (options?.accessibleSeats ?? []).map((s) => `${s.row}-${s.column}`),
  );
  const blockedSet = new Set((options?.blockedSeats ?? []).map((s) => `${s.row}-${s.column}`));

  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns; col++) {
      const key = `${row}-${col}`;
      let type: SeatType = 'STANDARD';

      if (blockedSet.has(key)) {
        type = 'BLOCKED';
      } else if (accessibleSet.has(key)) {
        type = 'DISABLED_ACCESSIBLE';
      } else if (premiumRowSet.has(row)) {
        type = 'PREMIUM';
      }

      seats.push({
        row,
        column: col,
        label: `${row}${columnLabel(col)}`,
        type,
        price: 0,
      });
    }
  }

  return seats;
}

/**
 * Count the number of bookable (non-blocked) seats in a seat layout.
 * @param seats - Array of seat data.
 * @returns Number of bookable seats.
 */
function countBookableSeats(seats: CreateSeatData[]): number {
  return seats.filter((s) => s.type !== 'BLOCKED').length;
}

// ─── Coach Templates ──────────────────────────────────────────────────────────

const mercedesTourismoSeats = generateSeatGrid(13, 4, {
  premiumRows: [1, 2],
  accessibleSeats: [{ row: 1, column: 1 }],
});

/** Mercedes Tourismo coach — 13 rows x 4 columns. */
const mercedesTourismo: BusTemplate = {
  id: 'coach-mercedes-tourismo',
  name: 'Mercedes Tourismo 13x4',
  rows: 13,
  columns: 4,
  capacity: countBookableSeats(mercedesTourismoSeats),
  seats: mercedesTourismoSeats,
};

const setraS515Seats = generateSeatGrid(12, 4, {
  premiumRows: [1, 2],
  accessibleSeats: [{ row: 1, column: 1 }],
  blockedSeats: [{ row: 12, column: 3 }],
});

/** Setra S515 HD coach — 12 rows x 4 columns with one blocked seat at rear. */
const setraS515: BusTemplate = {
  id: 'coach-setra-s515',
  name: 'Setra S515 HD 12x4',
  rows: 12,
  columns: 4,
  capacity: countBookableSeats(setraS515Seats),
  seats: setraS515Seats,
};

const neoplanCitylinerSeats = generateSeatGrid(14, 4, {
  premiumRows: [1, 2, 3],
  accessibleSeats: [
    { row: 1, column: 1 },
    { row: 1, column: 4 },
  ],
});

/** Neoplan Cityliner coach — 14 rows x 4 columns with extra premium rows. */
const neoplanCityliner: BusTemplate = {
  id: 'coach-neoplan-cityliner',
  name: 'Neoplan Cityliner 14x4',
  rows: 14,
  columns: 4,
  capacity: countBookableSeats(neoplanCitylinerSeats),
  seats: neoplanCitylinerSeats,
};

// ─── Minibus Templates ────────────────────────────────────────────────────────

const mercedesSprinterSeats = generateSeatGrid(8, 3, {
  premiumRows: [1],
  accessibleSeats: [{ row: 8, column: 1 }],
});

/** Mercedes Sprinter minibus — 8 rows x 3 columns. */
const mercedesSprinter: BusTemplate = {
  id: 'minibus-mercedes-sprinter',
  name: 'Mercedes Sprinter 8x3',
  rows: 8,
  columns: 3,
  capacity: countBookableSeats(mercedesSprinterSeats),
  seats: mercedesSprinterSeats,
};

const ivecoDailySeats = generateSeatGrid(7, 3, {
  premiumRows: [1],
  accessibleSeats: [{ row: 7, column: 1 }],
});

/** Iveco Daily minibus — 7 rows x 3 columns. */
const ivecoDaily: BusTemplate = {
  id: 'minibus-iveco-daily',
  name: 'Iveco Daily 7x3',
  rows: 7,
  columns: 3,
  capacity: countBookableSeats(ivecoDailySeats),
  seats: ivecoDailySeats,
};

// ─── Microbus Templates ──────────────────────────────────────────────────────

const fordTransitSeats = generateSeatGrid(5, 3, {
  accessibleSeats: [{ row: 1, column: 1 }],
});

/** Ford Transit microbus — 5 rows x 3 columns. */
const fordTransit: BusTemplate = {
  id: 'microbus-ford-transit',
  name: 'Ford Transit 5x3',
  rows: 5,
  columns: 3,
  capacity: countBookableSeats(fordTransitSeats),
  seats: fordTransitSeats,
};

const vwCrafterSeats = generateSeatGrid(4, 3, {
  accessibleSeats: [{ row: 1, column: 1 }],
  blockedSeats: [{ row: 4, column: 3 }],
});

/** VW Crafter microbus — 4 rows x 3 columns with one blocked seat. */
const vwCrafter: BusTemplate = {
  id: 'microbus-vw-crafter',
  name: 'VW Crafter 4x3',
  rows: 4,
  columns: 3,
  capacity: countBookableSeats(vwCrafterSeats),
  seats: vwCrafterSeats,
};

/**
 * All available bus templates indexed by category.
 * Coach: large intercity buses (40-56 seats).
 * Minibus: medium vehicles (21-24 seats).
 * Microbus: small vehicles (11-15 seats).
 */
export const BUS_TEMPLATES: readonly BusTemplate[] = [
  mercedesTourismo,
  setraS515,
  neoplanCityliner,
  mercedesSprinter,
  ivecoDaily,
  fordTransit,
  vwCrafter,
] as const;

/**
 * Look up a bus template by its identifier.
 * @param id - Template identifier (e.g., 'coach-mercedes-tourismo').
 * @returns The matching template, or undefined if not found.
 */
export function findTemplateById(id: string): BusTemplate | undefined {
  return BUS_TEMPLATES.find((t) => t.id === id);
}
