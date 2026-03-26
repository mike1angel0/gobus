/** Schedule status matching Prisma ScheduleStatus enum and OpenAPI ScheduleStatus schema. */
export type ScheduleStatus = 'ACTIVE' | 'CANCELLED';

/**
 * Stop time entity representing arrival/departure times for a stop in a schedule.
 * Matches the OpenAPI StopTime schema.
 */
export interface StopTimeEntity {
  /** Unique stop time identifier (cuid). */
  id: string;
  /** Stop name (city or station name). */
  stopName: string;
  /** Arrival time at this stop. */
  arrivalTime: Date;
  /** Departure time from this stop. */
  departureTime: Date;
  /** Position in the schedule (0-based). */
  orderIndex: number;
  /** Ticket price from the first stop to this stop. */
  priceFromStart: number;
  /** Latitude of the stop. */
  lat: number | null;
  /** Longitude of the stop. */
  lng: number | null;
}

/**
 * Schedule entity representing a transport trip.
 * Matches the OpenAPI Schedule schema — this is the shape returned in list responses.
 */
export interface ScheduleEntity {
  /** Unique schedule identifier (cuid). */
  id: string;
  /** Route identifier for this schedule. */
  routeId: string;
  /** Bus identifier assigned to this schedule. */
  busId: string;
  /** Driver identifier assigned to this schedule, or null if unassigned. */
  driverId: string | null;
  /** Departure time from the first stop. */
  departureTime: Date;
  /** Arrival time at the last stop. */
  arrivalTime: Date;
  /** Days of week this schedule repeats (0=Sunday, 6=Saturday). */
  daysOfWeek: number[];
  /** Base ticket price for the full trip. */
  basePrice: number;
  /** Current schedule status. */
  status: ScheduleStatus;
  /** Date of the trip. */
  tripDate: Date;
  /** Timestamp when the schedule was created. */
  createdAt: Date;
}

/**
 * Nested driver summary included in schedule detail responses.
 * Matches the OpenAPI ScheduleWithDetails driver property.
 */
export interface ScheduleDriverSummary {
  /** Driver user identifier. */
  id: string;
  /** Driver full name. */
  name: string;
}

/**
 * Nested route summary included in schedule detail responses.
 * Matches the OpenAPI Route schema (without stops).
 */
export interface ScheduleRouteSummary {
  /** Unique route identifier (cuid). */
  id: string;
  /** Route name (e.g., Bucharest - Cluj). */
  name: string;
  /** Provider who owns this route. */
  providerId: string;
  /** Route creation timestamp. */
  createdAt: Date;
}

/**
 * Nested bus summary included in schedule detail responses.
 * Matches the OpenAPI Bus schema (without seats).
 */
export interface ScheduleBusSummary {
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
 * Schedule with full details including route, bus, driver, and stop times.
 * Matches the OpenAPI ScheduleWithDetails schema — this is the shape returned in detail responses.
 */
export interface ScheduleWithDetails extends ScheduleEntity {
  /** Ordered list of stop times for this schedule. */
  stopTimes: StopTimeEntity[];
  /** Route assigned to this schedule. */
  route: ScheduleRouteSummary;
  /** Bus assigned to this schedule. */
  bus: ScheduleBusSummary;
  /** Driver assigned to this schedule, or null if unassigned. */
  driver: ScheduleDriverSummary | null;
}

/**
 * Input data for creating a stop time in a schedule.
 * Matches the OpenAPI CreateStopTimeInput schema.
 */
export interface CreateStopTimeData {
  /** Stop name (city or station name). */
  stopName: string;
  /** Arrival time at this stop. */
  arrivalTime: Date;
  /** Departure time from this stop. */
  departureTime: Date;
  /** Position in the schedule (0-based). */
  orderIndex: number;
  /** Ticket price from the first stop to this stop. */
  priceFromStart: number;
  /** Latitude of the stop. */
  lat?: number;
  /** Longitude of the stop. */
  lng?: number;
}

/**
 * Input data for creating a schedule with stop times.
 * Matches the OpenAPI CreateScheduleRequest schema.
 */
export interface CreateScheduleData {
  /** Route identifier to use for this schedule. */
  routeId: string;
  /** Bus identifier to assign to this schedule. */
  busId: string;
  /** Driver identifier to assign, or undefined if unassigned. */
  driverId?: string;
  /** Departure time from the first stop. */
  departureTime: Date;
  /** Arrival time at the last stop. */
  arrivalTime: Date;
  /** Days of week this schedule repeats (0=Sunday, 6=Saturday). */
  daysOfWeek?: number[];
  /** Base ticket price for the full trip. */
  basePrice: number;
  /** Date of the trip. */
  tripDate: Date;
  /** Ordered list of stop times (minimum 2). */
  stopTimes: CreateStopTimeData[];
}

/**
 * Input data for updating a schedule. All fields are optional.
 * Matches the OpenAPI UpdateScheduleRequest schema.
 */
export interface UpdateScheduleData {
  /** Driver identifier to assign, or null to unassign. */
  driverId?: string | null;
  /** New schedule status. */
  status?: ScheduleStatus;
  /** Updated departure time. */
  departureTime?: Date;
  /** Updated arrival time. */
  arrivalTime?: Date;
}
