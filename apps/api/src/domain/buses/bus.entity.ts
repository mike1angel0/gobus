/** Seat type classification matching Prisma SeatType enum and OpenAPI SeatType schema. */
export type SeatType = 'STANDARD' | 'PREMIUM' | 'DISABLED_ACCESSIBLE' | 'BLOCKED';

/**
 * Seat entity representing a single seat in a bus.
 * Matches the OpenAPI Seat schema — this is the shape returned in API responses.
 */
export interface SeatEntity {
  /** Unique seat identifier (cuid). */
  id: string;
  /** Seat row number (1-based). */
  row: number;
  /** Seat column number (1-based). */
  column: number;
  /** Seat label displayed to passengers (e.g., 1A, 2B). */
  label: string;
  /** Seat type classification. */
  type: SeatType;
  /** Price override for this seat (0 means use base price). */
  price: number;
  /** Whether this seat is available for booking. */
  isEnabled: boolean;
}

/**
 * Bus entity representing a transport vehicle.
 * Matches the OpenAPI Bus schema — this is the shape returned in list responses.
 */
export interface BusEntity {
  /** Unique bus identifier (cuid). */
  id: string;
  /** Unique license plate number. */
  licensePlate: string;
  /** Bus model name. */
  model: string;
  /** Total number of seats. */
  capacity: number;
  /** Number of seat rows. */
  rows: number;
  /** Number of seat columns. */
  columns: number;
  /** Provider who owns this bus. */
  providerId: string;
  /** Bus creation timestamp. */
  createdAt: Date;
}

/**
 * Bus with its full seat layout.
 * Matches the OpenAPI BusWithSeats schema — this is the shape returned in detail responses.
 */
export interface BusWithSeats extends BusEntity {
  /** Full seat layout of the bus. */
  seats: SeatEntity[];
}

/**
 * Input data for creating a seat in a bus.
 * Matches the OpenAPI CreateSeatInput schema.
 */
export interface CreateSeatData {
  /** Seat row number (1-based). */
  row: number;
  /** Seat column number (1-based). */
  column: number;
  /** Seat label (e.g., 1A, 2B). */
  label: string;
  /** Seat type classification. */
  type: SeatType;
  /** Price override for this seat (0 means use base price). */
  price?: number;
}

/**
 * Input data for creating a bus with seats.
 * Matches the OpenAPI CreateBusRequest schema.
 */
export interface CreateBusData {
  /** Unique license plate number. */
  licensePlate: string;
  /** Bus model name. */
  model: string;
  /** Total number of seats. */
  capacity: number;
  /** Number of seat rows. */
  rows: number;
  /** Number of seat columns. */
  columns: number;
  /** Seat layout definition. */
  seats: CreateSeatData[];
}

/**
 * Input data for updating a bus. All fields are optional.
 * Matches the OpenAPI UpdateBusRequest schema (no rows/columns/seats — grid is immutable).
 */
export interface UpdateBusData {
  /** Unique license plate number. */
  licensePlate?: string;
  /** Bus model name. */
  model?: string;
  /** Total number of seats. */
  capacity?: number;
}

/**
 * Bus template with predefined seat layout.
 * Matches the OpenAPI BusTemplate schema.
 */
export interface BusTemplate {
  /** Template identifier. */
  id: string;
  /** Template name (e.g., Mercedes Tourismo 13x4). */
  name: string;
  /** Number of seat rows. */
  rows: number;
  /** Number of seat columns. */
  columns: number;
  /** Total number of bookable seats. */
  capacity: number;
  /** Predefined seat layout. */
  seats: CreateSeatData[];
}
