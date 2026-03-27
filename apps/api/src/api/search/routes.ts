import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { SearchService } from '@/application/services/search.service.js';
import { strictParse } from '@/shared/schemas.js';
import { SEARCH_RATE_LIMIT } from '@/api/plugins/rate-limit.js';
import { cachePublic } from '@/api/plugins/cache-control.js';
import type { SearchResult, TripDetail, TripStopTime } from '@/domain/search/search.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import {
  searchQuerySchema,
  tripDetailParamsSchema,
  tripDetailQuerySchema,
} from '@/api/search/schemas.js';

/**
 * Serialize a SearchResult domain entity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeSearchResult(result: SearchResult): Record<string, unknown> {
  return {
    scheduleId: result.scheduleId,
    providerName: result.providerName,
    routeName: result.routeName,
    origin: result.origin,
    destination: result.destination,
    departureTime: result.departureTime.toISOString(),
    arrivalTime: result.arrivalTime.toISOString(),
    tripDate: result.tripDate.toISOString().slice(0, 10),
    price: result.price,
    availableSeats: result.availableSeats,
    totalSeats: result.totalSeats,
  };
}

/**
 * Serialize a TripStopTime to a JSON-safe response object.
 * Convert Date fields to ISO strings.
 */
function serializeStopTime(st: TripStopTime): Record<string, unknown> {
  return {
    id: st.id,
    stopName: st.stopName,
    arrivalTime: st.arrivalTime.toISOString(),
    departureTime: st.departureTime.toISOString(),
    orderIndex: st.orderIndex,
    priceFromStart: st.priceFromStart,
    lat: st.lat,
    lng: st.lng,
  };
}

/**
 * Serialize a TripDetail domain entity to a JSON-safe response object.
 * Convert Date fields to ISO strings and serialize nested collections.
 */
function serializeTripDetail(detail: TripDetail): Record<string, unknown> {
  return {
    scheduleId: detail.scheduleId,
    routeName: detail.routeName,
    providerName: detail.providerName,
    departureTime: detail.departureTime.toISOString(),
    arrivalTime: detail.arrivalTime.toISOString(),
    tripDate: detail.tripDate.toISOString().slice(0, 10),
    basePrice: detail.basePrice,
    status: detail.status,
    stopTimes: detail.stopTimes.map(serializeStopTime),
    seats: detail.seats,
  };
}

/**
 * Register public search endpoints: GET /api/v1/search and GET /api/v1/trips/:scheduleId.
 * Both endpoints are public (no authentication required) and match the OpenAPI spec.
 */
async function searchRoutes(app: FastifyInstance): Promise<void> {
  const searchService = new SearchService(getPrisma());

  // GET /api/v1/cities — list available cities for search dropdowns
  app.get(
    '/api/v1/cities',
    { preHandler: [cachePublic(300)], config: { rateLimit: SEARCH_RATE_LIMIT } },
    async () => {
      const cities = await searchService.listCities();
      return { data: cities };
    },
  );

  // GET /api/v1/search — search for available trips
  app.get(
    '/api/v1/search',
    { preHandler: [cachePublic(30)], config: { rateLimit: SEARCH_RATE_LIMIT } },
    async (request) => {
      const { origin, destination, date, page, pageSize } = strictParse(
        searchQuerySchema,
        request.query,
      );

      const result = await searchService.searchTrips({ origin, destination, date, page, pageSize });

      return {
        data: result.data.map(serializeSearchResult),
        meta: result.meta,
      };
    },
  );

  // GET /api/v1/trips/:scheduleId — get trip details with seat availability
  app.get(
    '/api/v1/trips/:scheduleId',
    { preHandler: [cachePublic(10)], config: { rateLimit: SEARCH_RATE_LIMIT } },
    async (request) => {
      const { scheduleId } = strictParse(tripDetailParamsSchema, request.params);
      const { tripDate } = strictParse(tripDetailQuerySchema, request.query);

      const detail = await searchService.getTripDetails(scheduleId, tripDate);

      return { data: serializeTripDetail(detail) };
    },
  );
}

export default fp(searchRoutes, {
  name: 'search-routes',
});
