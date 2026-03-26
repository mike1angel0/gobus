import type { BookingStatus, ScheduleStatus } from '@/generated/prisma/client.js';

/** Stop time data for a driver trip detail view. */
export interface DriverTripStopTime {
  /** Unique stop time identifier (cuid). */
  id: string;
  /** Name of the stop. */
  stopName: string;
  /** Scheduled arrival time at this stop. */
  arrivalTime: Date;
  /** Scheduled departure time from this stop. */
  departureTime: Date;
  /** Position in schedule (0-based). */
  orderIndex: number;
  /** Ticket price from first stop to this stop. */
  priceFromStart: number;
  /** Latitude of the stop. */
  lat: number | null;
  /** Longitude of the stop. */
  lng: number | null;
}

/** Summary trip data for the driver's trip list. */
export interface DriverTrip {
  /** Schedule identifier. */
  scheduleId: string;
  /** Scheduled departure time. */
  departureTime: Date;
  /** Scheduled arrival time. */
  arrivalTime: Date;
  /** Date of this trip. */
  tripDate: Date;
  /** Name of the route. */
  routeName: string;
  /** License plate of the assigned bus. */
  busLicensePlate: string;
  /** Schedule status. */
  status: ScheduleStatus;
}

/** Detailed trip data for the driver's trip detail view. */
export interface DriverTripDetail {
  /** Schedule identifier. */
  scheduleId: string;
  /** Scheduled departure time. */
  departureTime: Date;
  /** Scheduled arrival time. */
  arrivalTime: Date;
  /** Date of this trip. */
  tripDate: Date;
  /** Name of the route. */
  routeName: string;
  /** Assigned bus identifier (needed for tracking updates). */
  busId: string;
  /** License plate of the assigned bus. */
  busLicensePlate: string;
  /** Model name of the assigned bus. */
  busModel: string;
  /** Schedule status. */
  status: ScheduleStatus;
  /** Ordered list of stop times for this trip. */
  stops: DriverTripStopTime[];
  /** Number of confirmed passengers for this trip. */
  passengerCount: number;
  /** Total seat capacity of the bus. */
  totalSeats: number;
}

/** A passenger booking for a driver's trip. */
export interface DriverTripPassenger {
  /** Booking identifier. */
  bookingId: string;
  /** Passenger display name. */
  passengerName: string;
  /** Boarding stop name. */
  boardingStop: string;
  /** Alighting stop name. */
  alightingStop: string;
  /** Booked seat labels. */
  seatLabels: string[];
  /** Booking status. */
  status: BookingStatus;
}
