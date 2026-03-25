import { z } from 'zod';
import { dataResponse } from '@/shared/schemas.js';

/** Zod enum for delay reason matching OpenAPI DelayReason. */
const delayReasonEnum = z.enum(['TRAFFIC', 'MECHANICAL', 'WEATHER', 'OTHER']);

/** Zod schema for GET /api/v1/delays query parameters matching OpenAPI spec. */
export const listDelaysQuerySchema = z
  .object({
    scheduleId: z
      .string()
      .min(1)
      .max(30)
      .describe('Schedule to get delays for'),
    tripDate: z
      .string()
      .date()
      .max(10)
      .describe('Trip date to filter delays. ISO 8601 date format.'),
  })
  .strict();

/** Zod schema for POST /api/v1/delays request body matching OpenAPI CreateDelayRequest. */
export const createDelayBodySchema = z
  .object({
    scheduleId: z
      .string()
      .min(1)
      .max(30)
      .describe('Schedule to report delay for'),
    offsetMinutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .describe('Delay duration in minutes'),
    reason: delayReasonEnum.describe('Reason for the delay'),
    note: z
      .string()
      .max(500)
      .describe('Optional free-text note about the delay')
      .optional(),
    tripDate: z
      .string()
      .date()
      .max(10)
      .describe('Date of the affected trip (ISO 8601 date format)'),
  })
  .strict();

/** Zod schema for PUT /api/v1/delays/{id} request body matching OpenAPI UpdateDelayRequest. */
export const updateDelayBodySchema = z
  .object({
    offsetMinutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .describe('Updated delay duration in minutes')
      .optional(),
    reason: delayReasonEnum
      .describe('Updated reason for the delay')
      .optional(),
    note: z
      .string()
      .max(500)
      .nullable()
      .describe('Updated free-text note about the delay')
      .optional(),
    active: z
      .boolean()
      .describe('Whether the delay is currently active')
      .optional(),
  })
  .strict();

/** Zod schema for a Delay response object matching OpenAPI Delay schema. */
export const delaySchema = z.object({
  id: z.string().max(30).describe('Unique delay record identifier (cuid)'),
  scheduleId: z.string().max(30).describe('Schedule affected by the delay'),
  offsetMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .describe('Delay duration in minutes'),
  reason: delayReasonEnum.describe('Reason for a schedule delay'),
  note: z
    .string()
    .max(500)
    .nullable()
    .describe('Optional free-text note about the delay'),
  tripDate: z
    .string()
    .datetime()
    .max(30)
    .describe('Date of the affected trip'),
  active: z.boolean().describe('Whether the delay is currently active'),
  createdAt: z
    .string()
    .datetime()
    .max(30)
    .describe('Delay creation timestamp'),
});

/** Zod schema for DelayDataResponse { data: Delay }. */
export const delayDataResponseSchema = dataResponse(delaySchema);

/** Zod schema for DelayListResponse { data: Delay[] }. */
export const delayListResponseSchema = z.object({
  data: z.array(delaySchema).max(100).describe('Delays for the requested schedule and date'),
});
