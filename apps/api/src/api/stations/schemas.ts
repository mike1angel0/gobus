import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Zod enum for station type matching OpenAPI StationType. */
export const stationTypeEnum = z.enum(['HUB', 'STATION', 'STOP']);

/** Zod enum for station facility matching OpenAPI StationFacility. */
export const stationFacilityEnum = z.enum([
  'WIFI',
  'PARKING',
  'WAITING_ROOM',
  'RESTROOM',
  'TICKET_OFFICE',
  'LUGGAGE_STORAGE',
]);

/** Zod schema for GET /api/v1/admin/stations query parameters matching OpenAPI spec. */
export const adminListStationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    type: stationTypeEnum.describe('Filter stations by type').optional(),
    city: z.string().min(1).max(200).describe('Filter stations by city name').optional(),
    isActive: z.coerce.boolean().describe('Filter stations by active status').optional(),
    search: z
      .string()
      .min(1)
      .max(200)
      .describe('Search stations by name or address')
      .optional(),
  })
  .strict();

/** Zod schema for POST /api/v1/admin/stations request body matching OpenAPI CreateStationRequest. */
export const createStationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).describe('Station display name'),
    cityName: z.string().trim().min(1).max(200).describe('City where the station is located'),
    type: stationTypeEnum.describe('Station type classification'),
    address: z.string().trim().min(1).max(500).describe('Full street address'),
    lat: z.number().min(-90).max(90).describe('Latitude coordinate'),
    lng: z.number().min(-180).max(180).describe('Longitude coordinate'),
    facilities: z
      .array(stationFacilityEnum)
      .min(0)
      .max(20)
      .describe('List of facilities available at this station')
      .optional(),
    phone: z.string().max(20).describe('Station contact phone number').optional(),
    email: z.string().email().max(255).describe('Station contact email address').optional(),
    platformCount: z
      .number()
      .int()
      .min(0)
      .max(100)
      .describe('Number of bus platforms/bays')
      .optional(),
  })
  .strict();

/** Zod schema for PATCH /api/v1/admin/stations/{id} request body matching OpenAPI UpdateStationRequest. */
export const updateStationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).describe('Station display name').optional(),
    cityName: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe('City where the station is located')
      .optional(),
    type: stationTypeEnum.describe('Station type classification').optional(),
    address: z.string().trim().min(1).max(500).describe('Full street address').optional(),
    lat: z.number().min(-90).max(90).describe('Latitude coordinate').optional(),
    lng: z.number().min(-180).max(180).describe('Longitude coordinate').optional(),
    facilities: z
      .array(stationFacilityEnum)
      .min(0)
      .max(20)
      .describe('List of facilities available at this station')
      .optional(),
    phone: z.string().max(20).nullable().describe('Station contact phone number').optional(),
    email: z.string().email().max(255).nullable().describe('Station contact email address').optional(),
    platformCount: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .describe('Number of bus platforms/bays')
      .optional(),
    isActive: z.boolean().describe('Whether the station is currently active').optional(),
  })
  .strict();

/** Zod schema for POST /api/v1/stations request body matching OpenAPI ProviderCreateStopRequest. */
export const providerCreateStopBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).describe('Stop display name'),
    cityName: z.string().trim().min(1).max(200).describe('City where the stop is located'),
    address: z.string().trim().min(1).max(500).describe('Full street address'),
    lat: z.number().min(-90).max(90).describe('Latitude coordinate'),
    lng: z.number().min(-180).max(180).describe('Longitude coordinate'),
  })
  .strict();

/** Zod schema for POST /api/v1/admin/stations/merge request body matching OpenAPI MergeStationsRequest. */
export const mergeStationsBodySchema = z
  .object({
    sourceId: z.string().min(1).max(30).describe('ID of the station to merge from'),
    targetId: z.string().min(1).max(30).describe('ID of the station to merge into'),
  })
  .strict();

/** Zod schema for GET /api/v1/stations query parameters. */
export const searchStationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    search: z
      .string()
      .min(1)
      .max(200)
      .describe('Search stations by name, city, or address')
      .optional(),
  })
  .strict();

/** Zod schema for a Station response object matching OpenAPI Station schema. */
export const stationSchema = z.object({
  id: z.string().max(30).describe('Unique station identifier (cuid)'),
  name: z.string().max(200).describe('Station display name'),
  cityName: z.string().max(200).describe('City where the station is located'),
  type: stationTypeEnum.describe('Station type classification'),
  address: z.string().max(500).describe('Full street address'),
  lat: z.number().min(-90).max(90).describe('Latitude coordinate'),
  lng: z.number().min(-180).max(180).describe('Longitude coordinate'),
  facilities: z.array(stationFacilityEnum).describe('List of facilities available'),
  phone: z.string().max(20).nullable().describe('Station contact phone number'),
  email: z.string().max(255).nullable().describe('Station contact email address'),
  platformCount: z.number().int().min(0).max(100).nullable().describe('Number of bus platforms/bays'),
  isActive: z.boolean().describe('Whether the station is currently active'),
  createdBy: z.string().max(30).describe('ID of the user who created this station'),
  createdAt: z.string().datetime().max(30).describe('Station creation timestamp'),
  updatedAt: z.string().datetime().max(30).describe('Station last update timestamp'),
});

/** Zod schema for StationListResponse { data: Station[], meta: PaginationMeta }. */
export const stationListResponseSchema = paginatedResponse(stationSchema);

/** Zod schema for StationDataResponse { data: Station }. */
export const stationDataResponseSchema = dataResponse(stationSchema);
