import { z } from 'zod';
import { dataResponse } from '@/shared/schemas.js';

/** Zod schema for the Provider response object matching OpenAPI Provider schema. */
export const providerSchema = z.object({
  id: z.string().max(30).describe('Unique provider identifier (cuid)'),
  name: z.string().max(200).describe('Provider company name'),
  logo: z.string().url().max(2048).nullable().describe('URL to provider logo image'),
  contactEmail: z.string().email().max(255).nullable().describe('Provider contact email'),
  contactPhone: z.string().max(20).nullable().describe('Provider contact phone number'),
  status: z.enum(['APPROVED', 'PENDING']).describe('Provider approval status'),
  createdAt: z.string().datetime().describe('Provider creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
});

/** Zod schema for ProviderDataResponse { data: Provider } matching OpenAPI. */
export const providerDataResponseSchema = dataResponse(providerSchema);

/** Revenue breakdown for a single route. */
export const revenueByRouteSchema = z.object({
  routeId: z.string().max(30).describe('Route identifier'),
  routeName: z.string().max(200).describe('Route name'),
  revenue: z.number().min(0).describe('Total revenue for this route'),
});

/** Dashboard analytics for a provider. */
export const providerAnalyticsSchema = z.object({
  totalBookings: z.number().int().min(0).describe('Total number of confirmed bookings'),
  totalRevenue: z.number().min(0).describe('Total revenue from confirmed bookings'),
  averageOccupancy: z.number().min(0).max(1).describe('Average seat occupancy ratio (0 to 1)'),
  revenueByRoute: z
    .array(revenueByRouteSchema)
    .min(0)
    .max(100)
    .describe('Revenue breakdown per route'),
});

/** Provider analytics data response. */
export const providerAnalyticsDataResponseSchema = dataResponse(providerAnalyticsSchema);
