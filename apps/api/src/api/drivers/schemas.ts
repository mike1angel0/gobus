import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Zod schema for the DriverStatus enum matching OpenAPI UserStatus. */
export const driverStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED']);

/** Zod schema for a Driver response object matching OpenAPI Driver schema. */
export const driverSchema = z.object({
  id: z.string().max(30).describe('Unique driver identifier (cuid)'),
  email: z.string().max(255).describe('Driver email address'),
  name: z.string().max(100).describe('Driver full name'),
  role: z.enum(['DRIVER']).describe('User role (always DRIVER)'),
  phone: z.string().max(20).nullable().describe('Optional phone number'),
  status: driverStatusSchema.describe('Account status'),
  providerId: z.string().max(30).describe('Provider this driver belongs to'),
  assignedScheduleCount: z
    .number()
    .int()
    .min(0)
    .max(10000)
    .describe('Number of schedules assigned to this driver'),
  createdAt: z.string().datetime().describe('Driver creation timestamp'),
});

/** Zod schema for CreateDriverRequest matching OpenAPI CreateDriverRequest schema. */
export const createDriverRequestSchema = z
  .object({
    email: z.string().email().max(255).describe('Driver email address (must be unique)'),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+/,
        'Password must contain uppercase, lowercase, and digit',
      )
      .describe('Driver password (min 8 chars, must contain uppercase, lowercase, and digit)'),
    name: z.string().min(1).max(100).describe('Driver full name'),
    phone: z.string().max(20).optional().describe('Optional phone number'),
  })
  .strict();

/** Zod schema for DriverDataResponse { data: Driver } matching OpenAPI. */
export const driverDataResponseSchema = dataResponse(driverSchema);

/** Zod schema for DriverListResponse { data: Driver[], meta: PaginationMeta } matching OpenAPI. */
export const driverListResponseSchema = paginatedResponse(driverSchema);
