import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { StationService } from '@/application/services/station.service.js';
import type { StationEntity } from '@/domain/stations/station.entity.js';
import { AuditActions } from '@/domain/audit/audit-actions.js';
import type { AuditAction } from '@/domain/audit/audit-actions.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireAdmin } from '@/api/plugins/role-guard.js';
import { idParamSchema, strictParse } from '@/shared/schemas.js';
import { noCache, privateNoCache } from '@/api/plugins/cache-control.js';
import {
  adminListStationsQuerySchema,
  createStationBodySchema,
  updateStationBodySchema,
  mergeStationsBodySchema,
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

/** Handle GET /api/v1/admin/stations — list all stations with optional filters. */
function handleListStations(stationService: StationService) {
  return async (request: { query: unknown }) => {
    const query = strictParse(adminListStationsQuerySchema, request.query);
    const result = await stationService.listStations(query);

    return { data: result.data.map(serializeStation), meta: result.meta };
  };
}

/** Handle POST /api/v1/admin/stations — create a new station. */
function handleCreateStation(stationService: StationService) {
  return async (
    request: { body: unknown; user: { id: string }; audit: (action: AuditAction, resource: string, resourceId: string) => void },
    reply: { status: (code: number) => { send: (data: unknown) => unknown } },
  ) => {
    const body = strictParse(createStationBodySchema, request.body);
    const station = await stationService.create(body, request.user.id);

    request.audit(AuditActions.STATION_CREATED, 'station', station.id);

    return reply.status(201).send({ data: serializeStation(station) });
  };
}

/** Handle GET /api/v1/admin/stations/:id — get station details. */
function handleGetStation(stationService: StationService) {
  return async (request: { params: unknown }) => {
    const { id } = strictParse(idParamSchema, request.params);
    const station = await stationService.getById(id);

    return { data: serializeStation(station) };
  };
}

/** Handle PATCH /api/v1/admin/stations/:id — update a station. */
function handleUpdateStation(stationService: StationService) {
  return async (request: { params: unknown; body: unknown; audit: (action: AuditAction, resource: string, resourceId: string) => void }) => {
    const { id } = strictParse(idParamSchema, request.params);
    const body = strictParse(updateStationBodySchema, request.body);
    const station = await stationService.update(id, body);

    request.audit(AuditActions.STATION_UPDATED, 'station', id);

    return { data: serializeStation(station) };
  };
}

/** Handle DELETE /api/v1/admin/stations/:id — deactivate a station. */
function handleDeactivateStation(stationService: StationService) {
  return async (
    request: { params: unknown; audit: (action: AuditAction, resource: string, resourceId: string) => void },
    reply: { status: (code: number) => { send: () => unknown } },
  ) => {
    const { id } = strictParse(idParamSchema, request.params);
    await stationService.deactivate(id);

    request.audit(AuditActions.STATION_DEACTIVATED, 'station', id);

    return reply.status(204).send();
  };
}

/** Handle POST /api/v1/admin/stations/merge — merge two stations. */
function handleMergeStations(stationService: StationService) {
  return async (request: { body: unknown; audit: (action: AuditAction, resource: string, resourceId: string) => void }) => {
    const { sourceId, targetId } = strictParse(mergeStationsBodySchema, request.body);
    const station = await stationService.merge(sourceId, targetId);

    request.audit(AuditActions.STATION_MERGED, 'station', targetId);

    return { data: serializeStation(station) };
  };
}

/**
 * Register admin station endpoints.
 * All endpoints require ADMIN role.
 */
async function adminStationRoutes(app: FastifyInstance): Promise<void> {
  const stationService = new StationService(getPrisma());

  app.get('/api/v1/admin/stations', { preHandler: [app.authenticate, requireAdmin, privateNoCache] }, handleListStations(stationService));
  app.post('/api/v1/admin/stations', { preHandler: [app.authenticate, requireAdmin, noCache] }, handleCreateStation(stationService));
  app.get('/api/v1/admin/stations/:id', { preHandler: [app.authenticate, requireAdmin, privateNoCache] }, handleGetStation(stationService));
  app.patch('/api/v1/admin/stations/:id', { preHandler: [app.authenticate, requireAdmin, noCache] }, handleUpdateStation(stationService));
  app.delete('/api/v1/admin/stations/:id', { preHandler: [app.authenticate, requireAdmin, noCache] }, handleDeactivateStation(stationService));
  app.post('/api/v1/admin/stations/merge', { preHandler: [app.authenticate, requireAdmin, noCache] }, handleMergeStations(stationService));
}

export default fp(adminStationRoutes, {
  name: 'admin-station-routes',
  dependencies: ['auth'],
});
