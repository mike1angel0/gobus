import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Zod schema for a Stop response object matching OpenAPI Stop schema. */
export const stopSchema = z.object({
  id: z.string().max(30).describe('Unique stop identifier (cuid)'),
  name: z.string().max(200).describe('Stop name (city or station name)'),
  lat: z.number().min(-90).max(90).describe('Latitude coordinate'),
  lng: z.number().min(-180).max(180).describe('Longitude coordinate'),
  orderIndex: z.number().int().min(0).max(100).describe('Position in the route (0-based)'),
});

/** Zod schema for a Route response object matching OpenAPI Route schema. */
export const routeSchema = z.object({
  id: z.string().max(30).describe('Unique route identifier (cuid)'),
  name: z.string().max(200).describe('Route name (e.g., Bucharest - Cluj)'),
  providerId: z.string().max(30).describe('Provider who owns this route'),
  createdAt: z.string().datetime().describe('Route creation timestamp'),
});

/** Zod schema for a RouteWithStops response object matching OpenAPI RouteWithStops schema. */
export const routeWithStopsSchema = z.object({
  id: z.string().max(30).describe('Unique route identifier (cuid)'),
  name: z.string().max(200).describe('Route name (e.g., Bucharest - Cluj)'),
  providerId: z.string().max(30).describe('Provider who owns this route'),
  stops: z.array(stopSchema).min(0).max(100).describe('Ordered list of stops on this route'),
  createdAt: z.string().datetime().describe('Route creation timestamp'),
});

/** Zod schema for CreateStopInput matching OpenAPI CreateStopInput schema. */
export const createStopInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).describe('Stop name (city or station name)'),
    lat: z.number().min(-90).max(90).describe('Latitude coordinate'),
    lng: z.number().min(-180).max(180).describe('Longitude coordinate'),
    orderIndex: z.number().int().min(0).max(100).describe('Position in the route (0-based)'),
  })
  .strict();

/** Zod schema for CreateRouteRequest matching OpenAPI CreateRouteRequest schema. */
export const createRouteRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).describe('Route name (e.g., Bucharest - Cluj)'),
    stops: z
      .array(createStopInputSchema)
      .min(2)
      .max(100)
      .describe('Ordered list of stops (minimum 2 for a valid route)'),
  })
  .strict();

/** Zod schema for RouteWithStopsDataResponse { data: RouteWithStops } matching OpenAPI. */
export const routeWithStopsDataResponseSchema = dataResponse(routeWithStopsSchema);

/** Zod schema for RouteListResponse { data: Route[], meta: PaginationMeta } matching OpenAPI. */
export const routeListResponseSchema = paginatedResponse(routeSchema);
