import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Zod schema for the SeatType enum matching OpenAPI SeatType. */
export const seatTypeSchema = z.enum(['STANDARD', 'PREMIUM', 'DISABLED_ACCESSIBLE', 'BLOCKED']);

/** Zod schema for a Seat response object matching OpenAPI Seat schema. */
export const seatSchema = z.object({
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
});

/** Zod schema for a Bus response object matching OpenAPI Bus schema. */
export const busSchema = z.object({
  id: z.string().max(30).describe('Unique bus identifier (cuid)'),
  licensePlate: z.string().max(20).describe('Unique license plate number'),
  model: z.string().max(100).describe('Bus model name'),
  capacity: z.number().int().min(1).max(200).describe('Total number of seats'),
  rows: z.number().int().min(1).max(100).describe('Number of seat rows'),
  columns: z.number().int().min(1).max(10).describe('Number of seat columns'),
  providerId: z.string().max(30).describe('Provider who owns this bus'),
  createdAt: z.string().datetime().describe('Bus creation timestamp'),
});

/** Zod schema for a BusWithSeats response object matching OpenAPI BusWithSeats schema. */
export const busWithSeatsSchema = z.object({
  id: z.string().max(30).describe('Unique bus identifier (cuid)'),
  licensePlate: z.string().max(20).describe('Unique license plate number'),
  model: z.string().max(100).describe('Bus model name'),
  capacity: z.number().int().min(1).max(200).describe('Total number of seats'),
  rows: z.number().int().min(1).max(100).describe('Number of seat rows'),
  columns: z.number().int().min(1).max(10).describe('Number of seat columns'),
  providerId: z.string().max(30).describe('Provider who owns this bus'),
  seats: z.array(seatSchema).min(0).max(1000).describe('Full seat layout'),
  createdAt: z.string().datetime().describe('Bus creation timestamp'),
});

/** Zod schema for CreateSeatInput matching OpenAPI CreateSeatInput schema. */
export const createSeatInputSchema = z
  .object({
    row: z.number().int().min(1).max(100).describe('Seat row number'),
    column: z.number().int().min(1).max(10).describe('Seat column number'),
    label: z.string().trim().min(1).max(10).describe('Seat label (e.g., 1A, 2B)'),
    type: seatTypeSchema.describe('Seat type classification'),
    price: z
      .number()
      .min(0)
      .max(10000)
      .default(0)
      .describe('Price override for this seat (0 means use base price)'),
  })
  .strict();

/** Zod schema for CreateBusRequest matching OpenAPI CreateBusRequest schema. */
export const createBusRequestSchema = z
  .object({
    licensePlate: z.string().trim().min(1).max(20).describe('Unique license plate number'),
    model: z.string().trim().min(1).max(100).describe('Bus model name'),
    capacity: z.number().int().min(1).max(200).describe('Total number of seats'),
    rows: z.number().int().min(1).max(100).describe('Number of seat rows'),
    columns: z.number().int().min(1).max(10).describe('Number of seat columns'),
    seats: z.array(createSeatInputSchema).min(1).max(1000).describe('Seat layout definition'),
  })
  .strict();

/** Zod schema for UpdateBusRequest matching OpenAPI UpdateBusRequest schema. */
export const updateBusRequestSchema = z
  .object({
    licensePlate: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .describe('Unique license plate number')
      .optional(),
    model: z.string().trim().min(1).max(100).describe('Bus model name').optional(),
    capacity: z.number().int().min(1).max(200).describe('Total number of seats').optional(),
    rows: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe('Number of seat rows (required when updating seats)')
      .optional(),
    columns: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe('Number of seat columns (required when updating seats)')
      .optional(),
    seats: z
      .array(createSeatInputSchema)
      .min(1)
      .max(1000)
      .describe('Optional full seat layout replacement')
      .optional(),
  })
  .strict();

/** Zod schema for a BusTemplate response object matching OpenAPI BusTemplate schema. */
export const busTemplateSchema = z.object({
  id: z.string().max(30).describe('Template identifier'),
  name: z.string().max(100).describe('Template name (e.g., Standard 50-seat)'),
  rows: z.number().int().min(1).max(100).describe('Number of seat rows'),
  columns: z.number().int().min(1).max(10).describe('Number of seat columns'),
  capacity: z.number().int().min(1).max(200).describe('Total number of seats'),
  seats: z.array(createSeatInputSchema).min(1).max(1000).describe('Predefined seat layout'),
});

/** Zod schema for BusWithSeatsDataResponse { data: BusWithSeats } matching OpenAPI. */
export const busWithSeatsDataResponseSchema = dataResponse(busWithSeatsSchema);

/** Zod schema for BusListResponse { data: Bus[], meta: PaginationMeta } matching OpenAPI. */
export const busListResponseSchema = paginatedResponse(busSchema);

/** Zod schema for BusTemplateListResponse { data: BusTemplate[] } matching OpenAPI. */
export const busTemplateListResponseSchema = z.object({
  data: z.array(busTemplateSchema).min(0).max(100).describe('Available bus templates'),
});
