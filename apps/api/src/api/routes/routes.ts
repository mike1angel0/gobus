import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { RouteService } from '@/application/services/route.service.js';
import type { RouteEntity, RouteWithStops, StopEntity } from '@/domain/routes/route.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireProvider } from '@/api/plugins/role-guard.js';
import { paginationQuerySchema, idParamSchema } from '@/shared/schemas.js';
import { createRouteRequestSchema } from '@/api/routes/schemas.js';
import { privateNoCache } from '@/api/plugins/cache-control.js';

/**
 * Serialize a RouteEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeRoute(route: RouteEntity): Record<string, unknown> {
  return {
    ...route,
    createdAt: route.createdAt.toISOString(),
  };
}

/**
 * Serialize a StopEntity to a JSON-safe response object.
 * Ensures numeric fields are returned as numbers.
 */
function serializeStop(stop: StopEntity): Record<string, unknown> {
  return {
    id: stop.id,
    name: stop.name,
    lat: stop.lat,
    lng: stop.lng,
    orderIndex: stop.orderIndex,
  };
}

/**
 * Serialize a RouteWithStops to a JSON-safe response object.
 * Convert Date fields and include serialized stops array.
 */
function serializeRouteWithStops(route: RouteWithStops): Record<string, unknown> {
  return {
    ...route,
    createdAt: route.createdAt.toISOString(),
    stops: route.stops.map(serializeStop),
  };
}

/**
 * Register all route management endpoints under /api/v1/routes.
 * Implements GET (list), POST (create), GET /:id (detail), DELETE /:id from the OpenAPI spec.
 * All endpoints require PROVIDER role.
 */
async function routeRoutes(app: FastifyInstance): Promise<void> {
  const routeService = new RouteService(getPrisma());

  // GET /api/v1/routes — list provider's routes (paginated)
  app.get(
    '/api/v1/routes',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const { page, pageSize } = paginationQuerySchema.parse(request.query);
      const providerId = request.user.providerId!;

      const result = await routeService.listByProvider(providerId, { page, pageSize });

      return {
        data: result.data.map(serializeRoute),
        meta: result.meta,
      };
    },
  );

  // POST /api/v1/routes — create a new route with stops
  app.post(
    '/api/v1/routes',
    { preHandler: [app.authenticate, requireProvider] },
    async (request, reply) => {
      const body = createRouteRequestSchema.parse(request.body);
      const providerId = request.user.providerId!;

      const route = await routeService.create(providerId, body);

      return reply.status(201).send({ data: serializeRouteWithStops(route) });
    },
  );

  // GET /api/v1/routes/:id — get route details with stops
  app.get(
    '/api/v1/routes/:id',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const { id } = idParamSchema.parse(request.params);
      const providerId = request.user.providerId!;

      const route = await routeService.getById(id, providerId);

      return { data: serializeRouteWithStops(route) };
    },
  );

  // DELETE /api/v1/routes/:id — delete a route
  app.delete(
    '/api/v1/routes/:id',
    { preHandler: [app.authenticate, requireProvider] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const providerId = request.user.providerId!;

      await routeService.delete(id, providerId);

      return reply.status(204).send();
    },
  );
}

export default fp(routeRoutes, {
  name: 'route-routes',
  dependencies: ['auth'],
});
