/** Represents a single search result for an available trip between origin and destination. */
export interface SearchResult {
  /** Schedule identifier for this trip. */
  scheduleId: string;
  /** Name of the transport provider. */
  providerName: string;
  /** Name of the route. */
  routeName: string;
  /** Boarding stop name. */
  origin: string;
  /** Alighting stop name. */
  destination: string;
  /** Departure time from origin stop. */
  departureTime: Date;
  /** Arrival time at destination stop. */
  arrivalTime: Date;
  /** Date of the trip. */
  tripDate: Date;
  /** Computed segment price (destination priceFromStart minus origin priceFromStart). */
  price: number;
  /** Number of seats currently available for this trip and date. */
  availableSeats: number;
  /** Total number of enabled seats on the bus. */
  totalSeats: number;
}

/** Represents a seat with its current availability status for a specific trip date. */
export interface SeatAvailability {
  /** Unique seat identifier (cuid). */
  id: string;
  /** Seat row number. */
  row: number;
  /** Seat column number. */
  column: number;
  /** Seat label displayed to passengers (e.g., 1A, 2B). */
  label: string;
  /** Seat type (STANDARD, PREMIUM, DISABLED_ACCESSIBLE, BLOCKED). */
  type: string;
  /** Price override for this seat (0 means use base price). */
  price: number;
  /** Whether this seat is available for booking. */
  isEnabled: boolean;
  /** Whether this seat is already booked for the requested trip date. */
  isBooked: boolean;
}

/** Represents a stop time entry in a schedule. */
export interface TripStopTime {
  /** Unique stop time identifier. */
  id: string;
  /** Name of the stop. */
  stopName: string;
  /** Scheduled arrival time at this stop. */
  arrivalTime: Date;
  /** Scheduled departure time from this stop. */
  departureTime: Date;
  /** Position in the schedule (0-based). */
  orderIndex: number;
  /** Cumulative price from the first stop to this stop. */
  priceFromStart: number;
}

/** Detailed trip information with seat map and availability. */
export interface TripDetail {
  /** Schedule identifier. */
  scheduleId: string;
  /** Name of the route. */
  routeName: string;
  /** Name of the transport provider. */
  providerName: string;
  /** Departure time from first stop. */
  departureTime: Date;
  /** Arrival time at last stop. */
  arrivalTime: Date;
  /** Date of the trip. */
  tripDate: Date;
  /** Base price for the full route. */
  basePrice: number;
  /** Schedule status. */
  status: string;
  /** Ordered stop times for this schedule. */
  stopTimes: TripStopTime[];
  /** Seat map with availability status. */
  seats: SeatAvailability[];
}
