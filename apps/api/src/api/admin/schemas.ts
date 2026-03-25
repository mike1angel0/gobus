import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Zod enum for seat type matching OpenAPI SeatType. */
const seatTypeEnum = z.enum(['STANDARD', 'PREMIUM', 'DISABLED_ACCESSIBLE', 'BLOCKED']);

/** Zod schema for GET /api/v1/admin/buses query parameters matching OpenAPI spec. */
export const adminListBusesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    providerId: z.string().min(1).max(30).describe('Filter buses by provider').optional(),
  })
  .strict();

/** Zod schema for PATCH /api/v1/admin/seats/{id} request body matching OpenAPI AdminToggleSeatRequest. */
export const toggleSeatBodySchema = z
  .object({
    isEnabled: z
      .boolean()
      .describe('Whether the seat should be enabled (true) or disabled (false)'),
  })
  .strict();

/** Zod schema for a Bus response object matching OpenAPI Bus schema. */
export const busSchema = z.object({
  id: z.string().max(30).describe('Unique bus identifier (cuid)'),
  licensePlate: z.string().max(20).describe('Unique license plate number'),
  model: z.string().max(100).describe('Bus model name'),
  capacity: z.number().int().min(1).max(200).describe('Total number of seats'),
  rows: z.number().int().min(1).max(100).describe('Number of seat rows'),
  columns: z.number().int().min(1).max(10).describe('Number of seat columns'),
  providerId: z.string().max(30).describe('Provider who owns this bus'),
  createdAt: z.string().datetime().max(30).describe('Bus creation timestamp'),
});

/** Zod schema for a Seat response object matching OpenAPI Seat schema. */
export const seatSchema = z.object({
  id: z.string().max(30).describe('Unique seat identifier (cuid)'),
  row: z.number().int().min(1).max(100).describe('Seat row number'),
  column: z.number().int().min(1).max(10).describe('Seat column number'),
  label: z.string().max(10).describe('Seat label displayed to passengers (e.g., 1A, 2B)'),
  type: seatTypeEnum.describe('Type of bus seat'),
  price: z
    .number()
    .min(0)
    .max(10000)
    .describe('Price override for this seat (0 means use base price)'),
  isEnabled: z.boolean().describe('Whether this seat is available for booking'),
});

/** Zod schema for BusListResponse { data: Bus[], meta: PaginationMeta }. */
export const busListResponseSchema = paginatedResponse(busSchema);

/** Zod schema for SeatDataResponse { data: Seat }. */
export const seatDataResponseSchema = dataResponse(seatSchema);
