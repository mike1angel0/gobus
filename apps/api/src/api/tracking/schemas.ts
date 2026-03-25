import { z } from 'zod';
import { dataResponse } from '@/shared/schemas.js';

/** Zod schema for the busId path parameter matching OpenAPI busId param. */
export const busIdParamSchema = z
  .object({
    busId: z.string().min(1).max(30).describe('Bus identifier to track'),
  })
  .strict();

/** Zod schema for TrackingUpdate request body matching OpenAPI TrackingUpdate. */
export const trackingUpdateSchema = z
  .object({
    busId: z.string().min(1).max(30).describe('Bus to update tracking for'),
    lat: z.number().min(-90).max(90).describe('Current latitude coordinate'),
    lng: z.number().min(-180).max(180).describe('Current longitude coordinate'),
    speed: z.number().min(0).max(300).describe('Current speed in km/h'),
    heading: z
      .number()
      .min(0)
      .max(360)
      .describe('Compass heading in degrees (0 = North, 90 = East)'),
    currentStopIndex: z
      .number()
      .int()
      .min(0)
      .max(100)
      .describe('Index of the current or next stop in the route'),
    scheduleId: z
      .string()
      .min(1)
      .max(30)
      .describe('Active schedule ID (optional, inferred from assignment if omitted)')
      .optional(),
    tripDate: z.string().date().max(10).describe('Date of the current trip').optional(),
  })
  .strict();

/** Zod schema for BusTracking response matching OpenAPI BusTracking schema. */
export const busTrackingSchema = z.object({
  id: z.string().max(30).describe('Unique tracking record identifier (cuid)'),
  busId: z.string().max(30).describe('Bus being tracked'),
  lat: z.number().min(-90).max(90).describe('Current latitude coordinate'),
  lng: z.number().min(-180).max(180).describe('Current longitude coordinate'),
  speed: z.number().min(0).max(300).describe('Current speed in km/h'),
  heading: z.number().min(0).max(360).describe('Compass heading in degrees (0 = North, 90 = East)'),
  scheduleId: z.string().max(30).nullable().describe('Active schedule this bus is running'),
  currentStopIndex: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Index of the current or next stop in the route'),
  isActive: z.boolean().describe('Whether the bus is actively transmitting position'),
  tripDate: z.string().datetime().max(30).nullable().describe('Date of the current trip'),
  updatedAt: z.string().datetime().max(30).describe('Last position update timestamp'),
});

/** Zod schema for BusTrackingDataResponse { data: BusTracking }. */
export const busTrackingDataResponseSchema = dataResponse(busTrackingSchema);
