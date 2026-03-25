import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Query parameters for listing driver trips. */
export const listDriverTripsQuerySchema = z
  .object({
    date: z
      .string()
      .date()
      .max(10)
      .describe('Trip date to filter by (defaults to today). ISO 8601 date format.')
      .optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
  })
  .strict();

/** Path parameters for driver trip detail. */
export const scheduleIdParamSchema = z
  .object({
    scheduleId: z.string().min(1).max(30).describe('Schedule identifier'),
  })
  .strict();

/** Stop time within a driver trip detail. */
export const driverTripStopTimeSchema = z.object({
  id: z.string().max(30).describe('Stop time identifier'),
  stopName: z.string().max(200).describe('Name of the stop'),
  arrivalTime: z.string().datetime().max(30).describe('Arrival time at this stop'),
  departureTime: z.string().datetime().max(30).describe('Departure time from this stop'),
  orderIndex: z.number().int().min(0).max(100).describe('Order of this stop in the route'),
  priceFromStart: z.number().min(0).max(100000).describe('Cumulative price from the first stop'),
});

/** Driver trip summary for list endpoint. */
export const driverTripSchema = z.object({
  scheduleId: z.string().max(30).describe('Schedule identifier'),
  departureTime: z.string().datetime().max(30).describe('Scheduled departure time'),
  arrivalTime: z.string().datetime().max(30).describe('Scheduled arrival time'),
  tripDate: z.string().datetime().max(30).describe('Date of the trip'),
  routeName: z.string().max(200).describe('Name of the route'),
  busLicensePlate: z.string().max(20).describe('License plate of the assigned bus'),
  status: z.enum(['ACTIVE', 'CANCELLED']).describe('Schedule status'),
});

/** Driver trip list response { data: DriverTrip[], meta: PaginationMeta }. */
export const driverTripListResponseSchema = paginatedResponse(driverTripSchema);

/** Driver trip detail with stops and passenger info. */
export const driverTripDetailSchema = z.object({
  scheduleId: z.string().max(30).describe('Schedule identifier'),
  departureTime: z.string().datetime().max(30).describe('Scheduled departure time'),
  arrivalTime: z.string().datetime().max(30).describe('Scheduled arrival time'),
  tripDate: z.string().datetime().max(30).describe('Date of the trip'),
  routeName: z.string().max(200).describe('Name of the route'),
  busLicensePlate: z.string().max(20).describe('License plate of the assigned bus'),
  busModel: z.string().max(100).describe('Model of the assigned bus'),
  status: z.enum(['ACTIVE', 'CANCELLED']).describe('Schedule status'),
  stops: z
    .array(driverTripStopTimeSchema)
    .max(100)
    .describe('Route stops with arrival/departure times'),
  passengerCount: z
    .number()
    .int()
    .min(0)
    .max(200)
    .describe('Number of confirmed passengers for this trip'),
  totalSeats: z.number().int().min(0).max(200).describe('Total seat capacity of the bus'),
});

/** Driver trip detail data response. */
export const driverTripDetailDataResponseSchema = dataResponse(driverTripDetailSchema);
