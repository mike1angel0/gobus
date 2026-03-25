import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Zod schema for BookingStatus enum matching OpenAPI BookingStatus. */
export const bookingStatusSchema = z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED']);

/** Zod schema for creating a booking matching OpenAPI CreateBookingRequest. */
export const createBookingBodySchema = z
  .object({
    scheduleId: z.string().min(1).max(30).describe('Schedule to book'),
    seatLabels: z
      .array(z.string().trim().min(1).max(10).describe('Seat label (e.g. 1A, 2B)'))
      .min(1)
      .max(10)
      .describe('Seat labels to book'),
    boardingStop: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe('Name of boarding stop (must exist in schedule stop times)'),
    alightingStop: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe('Name of alighting stop (must come after boarding stop in route order)'),
    tripDate: z.string().date().max(10).describe('ISO 8601 date format (e.g. 2026-03-25)'),
  })
  .strict();

/** Zod schema for listing bookings query params matching OpenAPI parameters. */
export const listBookingsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    status: bookingStatusSchema.optional().describe('Filter bookings by status'),
  })
  .strict();

/** Zod schema for a booking response matching OpenAPI Booking schema. */
export const bookingSchema = z.object({
  id: z.string().max(30).describe('Unique booking identifier (cuid)'),
  orderId: z.string().max(30).describe('Human-friendly unique order identifier'),
  userId: z.string().max(30).describe('User who made the booking'),
  scheduleId: z.string().max(30).describe('Booked schedule ID'),
  totalPrice: z.number().min(0).max(1000000).describe('Total price for all booked seats'),
  status: bookingStatusSchema.describe('Booking status'),
  boardingStop: z.string().max(200).describe('Name of the boarding stop'),
  alightingStop: z.string().max(200).describe('Name of the alighting stop'),
  tripDate: z.string().datetime().max(30).describe('Date of the trip'),
  seatLabels: z
    .array(z.string().max(10).describe('Seat label'))
    .min(1)
    .max(10)
    .describe('Labels of booked seats'),
  createdAt: z.string().datetime().max(30).describe('Booking creation timestamp'),
});

/** Zod schema for booking with schedule details matching OpenAPI BookingWithDetails. */
export const bookingWithDetailsSchema = bookingSchema.extend({
  schedule: z
    .object({
      departureTime: z.string().datetime().max(30).describe('Departure time from first stop'),
      arrivalTime: z.string().datetime().max(30).describe('Arrival time at last stop'),
      route: z.object({
        id: z.string().max(30).describe('Route identifier'),
        name: z.string().max(200).describe('Name of the route'),
        provider: z.object({
          id: z.string().max(30).describe('Provider identifier'),
          name: z.string().max(200).describe('Name of the transport provider'),
        }),
      }),
      bus: z.object({
        id: z.string().max(30).describe('Bus identifier'),
        licensePlate: z.string().max(20).describe('Bus license plate number'),
        model: z.string().max(100).describe('Bus model'),
      }),
    })
    .describe('Expanded schedule with route and bus details'),
});

/** Zod schema for BookingWithDetailsDataResponse { data: BookingWithDetails }. */
export const bookingWithDetailsDataResponseSchema = dataResponse(bookingWithDetailsSchema);

/** Zod schema for BookingListResponse { data: Booking[], meta: PaginationMeta }. */
export const bookingListResponseSchema = paginatedResponse(bookingSchema);
