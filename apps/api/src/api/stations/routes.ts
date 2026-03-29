import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { StationService } from '@/application/services/station.service.js';
import type { StationEntity } from '@/domain/stations/station.entity.js';
import { AuditActions } from '@/domain/audit/audit-actions.js';
import type { AuditAction } from '@/domain/audit/audit-actions.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireProvider } from '@/api/plugins/role-guard.js';
import { strictParse } from '@/shared/schemas.js';
import { privateNoCache, noCache } from '@/api/plugins/cache-control.js';
import {
  searchStationsQuerySchema,
  providerCreateStopBodySchema,
} from '@/api/stations/schemas.js';

/**
 * Serialize a StationEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeStation(station: StationEntity): Record<string, unknown> {
  return {
    id: station.id,
    name: station.name,
    cityName: station.cityName,
    type: station.type,
    address: station.address,
    lat: station.lat,
    lng: station.lng,
    facilities: station.facilities,
    phone: station.phone,
    email: station.email,
    platformCount: station.platformCount,
    isActive: station.isActive,
    createdBy: station.createdBy,
    createdAt: station.createdAt.toISOString(),
    updatedAt: station.updatedAt.toISOString(),
  };
}

/**
 * Register public/provider station endpoints.
 * GET is authenticated (any role), POST requires PROVIDER role.
 */
async function stationRoutes(app: FastifyInstance): Promise<void> {
  const stationService = new StationService(getPrisma());

  // GET /api/v1/stations — search active stations (authenticated, any role)
  app.get(
    '/api/v1/stations',
    { preHandler: [app.authenticate, privateNoCache] },
    async (request: { query: unknown }) => {
      const query = strictParse(searchStationsQuerySchema, request.query);
      const result = await stationService.searchActive(query);

      return { data: result.data.map(serializeStation), meta: result.meta };
    },
  );

  // POST /api/v1/stations — provider creates a STOP
  app.post(
    '/api/v1/stations',
    { preHandler: [app.authenticate, requireProvider, noCache] },
    async (
      request: { body: unknown; user: { id: string }; audit: (action: AuditAction, resource: string, resourceId: string) => void },
      reply: { status: (code: number) => { send: (data: unknown) => unknown } },
    ) => {
      const body = strictParse(providerCreateStopBodySchema, request.body);
      const station = await stationService.create(
        { ...body, type: 'STOP', facilities: [] },
        request.user.id,
      );

      request.audit(AuditActions.STATION_CREATED, 'station', station.id);

      return reply.status(201).send({ data: serializeStation(station) });
    },
  );
}

export default fp(stationRoutes, {
  name: 'station-routes',
  dependencies: ['auth'],
});
