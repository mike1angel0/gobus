import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';
import { seatTypeSchema } from '@/api/buses/schemas.js';
import { scheduleStatusSchema } from '@/api/schedules/schemas.js';
import { stopTimeSchema } from '@/api/schedules/schemas.js';

/** Zod schema for search query parameters matching OpenAPI searchTrips parameters. */
export const searchQuerySchema = z
  .object({
    origin: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .describe('Origin stop name (minimum 2 characters, case-insensitive partial match)'),
    destination: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .describe('Destination stop name (minimum 2 characters, case-insensitive partial match)'),
    date: z.string().date().max(10).describe('Trip date (ISO 8601 date format, e.g. 2026-03-25)'),
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Number of items per page (max 50 for search)'),
  })
  .strict();

/** Zod schema for a SearchResult response object matching OpenAPI SearchResult schema. */
export const searchResultSchema = z.object({
  scheduleId: z.string().max(30).describe('Schedule identifier for this trip'),
  providerName: z.string().max(200).describe('Name of the transport provider'),
  routeName: z.string().max(200).describe('Name of the route'),
  origin: z.string().max(200).describe('Boarding stop name'),
  destination: z.string().max(200).describe('Alighting stop name'),
  departureTime: z.string().datetime().max(30).describe('Departure time from origin stop'),
  arrivalTime: z.string().datetime().max(30).describe('Arrival time at destination stop'),
  tripDate: z.string().date().max(10).describe('Date of the trip'),
  price: z
    .number()
    .min(0)
    .max(100000)
    .describe('Computed segment price (price at destination minus price at origin)'),
  availableSeats: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .describe('Number of seats currently available for this trip and date'),
  totalSeats: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .describe('Total number of enabled seats on the bus'),
});

/** Zod schema for a SeatAvailability response object matching OpenAPI SeatAvailability schema. */
export const seatAvailabilitySchema = z.object({
  id: z.string().max(30).describe('Unique seat identifier (cuid)'),
  row: z.number().int().min(1).max(100).describe('Seat row number'),
  column: z.number().int().min(1).max(10).describe('Seat column number'),
  label: z.string().max(10).describe('Seat label displayed to passengers (e.g., 1A, 2B)'),
  type: seatTypeSchema.describe('Seat type classification'),
  price: z
    .number()
    .min(0)
    .max(10000)
    .describe('Price override for this seat (0 means use base price)'),
  isEnabled: z.boolean().describe('Whether this seat is available for booking'),
  isBooked: z.boolean().describe('Whether this seat is already booked for the requested trip date'),
});

/** Zod schema for a TripDetail response object matching OpenAPI TripDetail schema. */
export const tripDetailSchema = z.object({
  scheduleId: z.string().max(30).describe('Schedule identifier'),
  routeName: z.string().max(200).describe('Name of the route'),
  providerName: z.string().max(200).describe('Name of the transport provider'),
  departureTime: z.string().datetime().max(30).describe('Departure time from first stop'),
  arrivalTime: z.string().datetime().max(30).describe('Arrival time at last stop'),
  tripDate: z.string().date().max(10).describe('Date of the trip'),
  basePrice: z.number().min(0).max(100000).describe('Base price for the full route'),
  status: scheduleStatusSchema.describe('Schedule status'),
  stopTimes: z
    .array(stopTimeSchema)
    .min(0)
    .max(100)
    .describe('Ordered stop times for this schedule'),
  seats: z
    .array(seatAvailabilitySchema)
    .min(0)
    .max(1000)
    .describe('Seat map with availability status'),
});

/** Zod schema for trip detail path parameters. */
export const tripDetailParamsSchema = z
  .object({
    scheduleId: z.string().min(1).max(30).describe('Schedule identifier'),
  })
  .strict();

/** Zod schema for trip detail query parameters. */
export const tripDetailQuerySchema = z
  .object({
    tripDate: z
      .string()
      .date()
      .max(10)
      .describe('Trip date to check seat availability for (ISO 8601 date format)'),
  })
  .strict();

/** Zod schema for SearchResultListResponse { data: SearchResult[], meta: PaginationMeta }. */
export const searchResultListResponseSchema = paginatedResponse(searchResultSchema);

/** Zod schema for TripDetailDataResponse { data: TripDetail }. */
export const tripDetailDataResponseSchema = dataResponse(tripDetailSchema);
