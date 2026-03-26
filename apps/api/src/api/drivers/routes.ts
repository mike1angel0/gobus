import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { DriverService } from '@/application/services/driver.service.js';
import type { DriverEntity } from '@/domain/drivers/driver.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireProvider } from '@/api/plugins/role-guard.js';
import { paginationQuerySchema, idParamSchema } from '@/shared/schemas.js';
import { createDriverRequestSchema } from '@/api/drivers/schemas.js';
import { privateNoCache } from '@/api/plugins/cache-control.js';

/**
 * Serialize a DriverEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeDriver(driver: DriverEntity): Record<string, unknown> {
  return {
    ...driver,
    createdAt: driver.createdAt.toISOString(),
  };
}

/**
 * Register all driver management endpoints under /api/v1/drivers.
 * Implements GET (list), POST (create), DELETE /:id from the OpenAPI spec.
 * All endpoints require PROVIDER role.
 */
async function driverRoutes(app: FastifyInstance): Promise<void> {
  const driverService = new DriverService(getPrisma());

  // GET /api/v1/drivers — list provider's drivers (paginated)
  app.get(
    '/api/v1/drivers',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const { page, pageSize } = paginationQuerySchema.parse(request.query);
      const providerId = request.user.providerId!;

      const result = await driverService.listByProvider(providerId, { page, pageSize });

      return {
        data: result.data.map(serializeDriver),
        meta: result.meta,
      };
    },
  );

  // POST /api/v1/drivers — create a new driver
  app.post(
    '/api/v1/drivers',
    { preHandler: [app.authenticate, requireProvider] },
    async (request, reply) => {
      const body = createDriverRequestSchema.parse(request.body);
      const providerId = request.user.providerId!;

      const driver = await driverService.create(providerId, body);

      return reply.status(201).send({ data: serializeDriver(driver) });
    },
  );

  // DELETE /api/v1/drivers/:id — delete a driver
  app.delete(
    '/api/v1/drivers/:id',
    { preHandler: [app.authenticate, requireProvider] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const providerId = request.user.providerId!;

      await driverService.delete(id, providerId);

      return reply.status(204).send();
    },
  );
}

export default fp(driverRoutes, {
  name: 'driver-routes',
  dependencies: ['auth'],
});
