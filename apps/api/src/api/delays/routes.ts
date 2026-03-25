import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { DelayService } from '@/application/services/delay.service.js';
import type { DelayData } from '@/domain/delays/delay.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { idParamSchema } from '@/shared/schemas.js';
import {
  listDelaysQuerySchema,
  createDelayBodySchema,
  updateDelayBodySchema,
} from '@/api/delays/schemas.js';

/**
 * Serialize a DelayData domain entity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeDelay(data: DelayData): Record<string, unknown> {
  return {
    id: data.id,
    scheduleId: data.scheduleId,
    offsetMinutes: data.offsetMinutes,
    reason: data.reason,
    note: data.note,
    tripDate: data.tripDate.toISOString(),
    active: data.active,
    createdAt: data.createdAt.toISOString(),
  };
}

/**
 * Register delay endpoints: GET list, POST create, PUT update.
 * GET requires authentication. POST requires DRIVER or PROVIDER role.
 * PUT requires PROVIDER role.
 */
async function delayRoutes(app: FastifyInstance): Promise<void> {
  const delayService = new DelayService(getPrisma());

  // GET /api/v1/delays — list delays for a schedule + tripDate (paginated)
  app.get('/api/v1/delays', { preHandler: [app.authenticate] }, async (request) => {
    const { scheduleId, tripDate, page, pageSize } = listDelaysQuerySchema.parse(request.query);
    const result = await delayService.getBySchedule(scheduleId, tripDate, page, pageSize);

    return { data: result.data.map(serializeDelay), meta: result.meta };
  });

  // POST /api/v1/delays — report a delay (DRIVER or PROVIDER)
  app.post('/api/v1/delays', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== 'DRIVER' && request.user.role !== 'PROVIDER') {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only drivers and providers can report delays');
    }

    const body = createDelayBodySchema.parse(request.body);
    const delay = await delayService.create(
      {
        id: request.user.id,
        role: request.user.role,
        providerId: request.user.providerId,
      },
      body,
    );

    return reply.status(201).send({ data: serializeDelay(delay) });
  });

  // PUT /api/v1/delays/:id — update a delay (PROVIDER only)
  app.put('/api/v1/delays/:id', { preHandler: [app.authenticate] }, async (request) => {
    if (request.user.role !== 'PROVIDER') {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only providers can update delays');
    }

    const { id } = idParamSchema.parse(request.params);
    const body = updateDelayBodySchema.parse(request.body);
    const delay = await delayService.update(id, request.user.providerId!, body);

    return { data: serializeDelay(delay) };
  });
}

export default fp(delayRoutes, {
  name: 'delay-routes',
  dependencies: ['auth'],
});
