import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';
import { routeSchema } from '@/api/routes/schemas.js';
import { busSchema } from '@/api/buses/schemas.js';

/** Zod schema for the ScheduleStatus enum matching OpenAPI ScheduleStatus. */
export const scheduleStatusSchema = z.enum(['ACTIVE', 'CANCELLED']);

/** Zod schema for a StopTime response object matching OpenAPI StopTime schema. */
export const stopTimeSchema = z.object({
  id: z.string().max(30).describe('Unique stop time identifier (cuid)'),
  stopName: z.string().max(200).describe('Name of the stop'),
  arrivalTime: z.string().datetime().describe('Scheduled arrival time at this stop'),
  departureTime: z.string().datetime().describe('Scheduled departure time from this stop'),
  orderIndex: z.number().int().min(0).max(100).describe('Position in the schedule (0-based)'),
  priceFromStart: z
    .number()
    .min(0)
    .max(100000)
    .describe('Cumulative price from the first stop to this stop'),
});

/** Zod schema for a Schedule response object matching OpenAPI Schedule schema. */
export const scheduleSchema = z.object({
  id: z.string().max(30).describe('Unique schedule identifier (cuid)'),
  routeId: z.string().max(30).describe('Associated route ID'),
  busId: z.string().max(30).describe('Assigned bus ID'),
  driverId: z.string().max(30).nullable().describe('Assigned driver ID (null if unassigned)'),
  departureTime: z.string().datetime().describe('Scheduled departure time from first stop'),
  arrivalTime: z.string().datetime().describe('Scheduled arrival time at last stop'),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(0)
    .max(7)
    .describe('Days of the week this schedule runs (0=Sunday, 6=Saturday)'),
  basePrice: z.number().min(0).max(100000).describe('Base price for the full route'),
  status: scheduleStatusSchema.describe('Schedule status'),
  tripDate: z.string().datetime().describe('Specific date for this trip instance'),
  createdAt: z.string().datetime().describe('Schedule creation timestamp'),
});

/** Zod schema for the driver summary nested in ScheduleWithDetails. */
export const scheduleDriverSummarySchema = z.object({
  id: z.string().max(30).describe('Driver user ID'),
  name: z.string().max(100).describe('Driver name'),
});

/** Zod schema for a ScheduleWithDetails response object matching OpenAPI ScheduleWithDetails schema. */
export const scheduleWithDetailsSchema = z.object({
  id: z.string().max(30).describe('Unique schedule identifier (cuid)'),
  routeId: z.string().max(30).describe('Associated route ID'),
  busId: z.string().max(30).describe('Assigned bus ID'),
  driverId: z.string().max(30).nullable().describe('Assigned driver ID (null if unassigned)'),
  departureTime: z.string().datetime().describe('Scheduled departure time from first stop'),
  arrivalTime: z.string().datetime().describe('Scheduled arrival time at last stop'),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(0)
    .max(7)
    .describe('Days of the week this schedule runs'),
  basePrice: z.number().min(0).max(100000).describe('Base price for the full route'),
  status: scheduleStatusSchema.describe('Schedule status'),
  tripDate: z.string().datetime().describe('Specific date for this trip instance'),
  stopTimes: z
    .array(stopTimeSchema)
    .min(0)
    .max(100)
    .describe('Ordered stop times for this schedule'),
  route: routeSchema.describe('Route assigned to this schedule'),
  bus: busSchema.describe('Bus assigned to this schedule'),
  driver: scheduleDriverSummarySchema.nullable().describe('Assigned driver (null if unassigned)'),
  createdAt: z.string().datetime().describe('Schedule creation timestamp'),
});

/** Zod schema for CreateStopTimeInput matching OpenAPI CreateStopTimeInput schema. */
export const createStopTimeInputSchema = z
  .object({
    stopName: z.string().min(1).max(200).describe('Name of the stop'),
    arrivalTime: z.string().datetime().describe('Scheduled arrival time at this stop'),
    departureTime: z.string().datetime().describe('Scheduled departure time from this stop'),
    orderIndex: z.number().int().min(0).max(100).describe('Position in the schedule (0-based)'),
    priceFromStart: z
      .number()
      .min(0)
      .max(100000)
      .describe('Cumulative price from the first stop to this stop'),
  })
  .strict();

/** Zod schema for CreateScheduleRequest matching OpenAPI CreateScheduleRequest schema. */
export const createScheduleRequestSchema = z
  .object({
    routeId: z.string().max(30).describe('Route to schedule'),
    busId: z.string().max(30).describe('Bus to assign'),
    driverId: z.string().max(30).optional().describe('Driver to assign (optional)'),
    departureTime: z.string().datetime().describe('Scheduled departure time from first stop'),
    arrivalTime: z.string().datetime().describe('Scheduled arrival time at last stop'),
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(0)
      .max(7)
      .optional()
      .describe('Days of the week this schedule runs (0=Sunday, 6=Saturday)'),
    basePrice: z.number().min(0).max(100000).describe('Base price for the full route'),
    tripDate: z.string().datetime().describe('Specific date for this trip instance'),
    stopTimes: z
      .array(createStopTimeInputSchema)
      .min(2)
      .max(100)
      .describe('Ordered stop times (minimum 2 for a valid schedule)'),
  })
  .strict();

/** Zod schema for UpdateScheduleRequest matching OpenAPI UpdateScheduleRequest schema. */
export const updateScheduleRequestSchema = z
  .object({
    driverId: z
      .string()
      .max(30)
      .nullable()
      .optional()
      .describe('Driver to assign (null to unassign)'),
    status: scheduleStatusSchema.optional().describe('Updated schedule status'),
    departureTime: z.string().datetime().optional().describe('Updated departure time'),
    arrivalTime: z.string().datetime().optional().describe('Updated arrival time'),
  })
  .strict();

/** Zod schema for schedule list filter query parameters. */
export const scheduleFilterQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    routeId: z.string().max(30).optional().describe('Filter by route ID'),
    busId: z.string().max(30).optional().describe('Filter by bus ID'),
    status: scheduleStatusSchema.optional().describe('Filter by schedule status'),
    fromDate: z.string().optional().describe('Filter schedules from this date (inclusive, ISO 8601)'),
    toDate: z.string().optional().describe('Filter schedules until this date (inclusive, ISO 8601)'),
  })
  .strict();

/** Zod schema for ScheduleWithDetailsDataResponse { data: ScheduleWithDetails } matching OpenAPI. */
export const scheduleWithDetailsDataResponseSchema = dataResponse(scheduleWithDetailsSchema);

/** Zod schema for ScheduleListResponse { data: Schedule[], meta: PaginationMeta } matching OpenAPI. */
export const scheduleListResponseSchema = paginatedResponse(scheduleSchema);
