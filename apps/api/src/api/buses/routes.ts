import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { BusService } from '@/application/services/bus.service.js';
import type {
  BusEntity,
  BusWithSeats,
  SeatEntity,
  BusTemplate,
  CreateSeatData,
} from '@/domain/buses/bus.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireProvider } from '@/api/plugins/role-guard.js';
import { paginationQuerySchema, idParamSchema } from '@/shared/schemas.js';
import { createBusRequestSchema, updateBusRequestSchema } from '@/api/buses/schemas.js';
import { cachePublic, privateNoCache } from '@/api/plugins/cache-control.js';

/**
 * Serialize a BusEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeBus(bus: BusEntity): Record<string, unknown> {
  return {
    ...bus,
    createdAt: bus.createdAt.toISOString(),
  };
}

/**
 * Serialize a SeatEntity to a JSON-safe response object.
 * Ensure all fields are returned in the expected shape.
 */
function serializeSeat(seat: SeatEntity): Record<string, unknown> {
  return {
    id: seat.id,
    row: seat.row,
    column: seat.column,
    label: seat.label,
    type: seat.type,
    price: seat.price,
    isEnabled: seat.isEnabled,
  };
}

/**
 * Serialize a BusWithSeats to a JSON-safe response object.
 * Convert Date fields and include serialized seats array.
 */
function serializeBusWithSeats(bus: BusWithSeats): Record<string, unknown> {
  return {
    ...bus,
    createdAt: bus.createdAt.toISOString(),
    seats: bus.seats.map(serializeSeat),
  };
}

/**
 * Serialize a CreateSeatData to a JSON-safe response object for templates.
 * Ensure price defaults to 0 when not specified.
 */
function serializeTemplateSeat(seat: CreateSeatData): Record<string, unknown> {
  return {
    row: seat.row,
    column: seat.column,
    label: seat.label,
    type: seat.type,
    price: seat.price ?? 0,
  };
}

/**
 * Serialize a BusTemplate to a JSON-safe response object.
 * Include the full seat layout for template preview.
 */
function serializeTemplate(template: BusTemplate): Record<string, unknown> {
  return {
    id: template.id,
    name: template.name,
    rows: template.rows,
    columns: template.columns,
    capacity: template.capacity,
    seats: template.seats.map(serializeTemplateSeat),
  };
}

/**
 * Register all bus management endpoints under /api/v1/buses.
 * Implements GET (list), POST (create), GET /:id (detail), PUT /:id (update),
 * DELETE /:id, GET /templates from the OpenAPI spec.
 * All endpoints require PROVIDER role.
 */
async function busRoutes(app: FastifyInstance): Promise<void> {
  const busService = new BusService(getPrisma());

  // GET /api/v1/buses/templates — list available bus templates
  // Registered before /:id to avoid matching "templates" as an id parameter
  app.get(
    '/api/v1/buses/templates',
    { preHandler: [app.authenticate, requireProvider, cachePublic(3600)] },
    async () => {
      const templates = busService.getTemplates();

      return { data: templates.map(serializeTemplate) };
    },
  );

  // GET /api/v1/buses — list provider's buses (paginated)
  app.get('/api/v1/buses', { preHandler: [app.authenticate, requireProvider, privateNoCache] }, async (request) => {
    const { page, pageSize } = paginationQuerySchema.parse(request.query);
    const providerId = request.user.providerId!;

    const result = await busService.listByProvider(providerId, { page, pageSize });

    return {
      data: result.data.map(serializeBus),
      meta: result.meta,
    };
  });

  // POST /api/v1/buses — create a new bus with seat layout
  app.post(
    '/api/v1/buses',
    { preHandler: [app.authenticate, requireProvider] },
    async (request, reply) => {
      const body = createBusRequestSchema.parse(request.body);
      const providerId = request.user.providerId!;

      const bus = await busService.create(providerId, body);

      return reply.status(201).send({ data: serializeBusWithSeats(bus) });
    },
  );

  // GET /api/v1/buses/:id — get bus details with seats
  app.get(
    '/api/v1/buses/:id',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const { id } = idParamSchema.parse(request.params);
      const providerId = request.user.providerId!;

      const bus = await busService.getById(id, providerId);

      return { data: serializeBusWithSeats(bus) };
    },
  );

  // PUT /api/v1/buses/:id — update a bus
  app.put(
    '/api/v1/buses/:id',
    { preHandler: [app.authenticate, requireProvider] },
    async (request) => {
      const { id } = idParamSchema.parse(request.params);
      const body = updateBusRequestSchema.parse(request.body);
      const providerId = request.user.providerId!;

      const bus = await busService.update(id, providerId, body);

      return { data: serializeBusWithSeats(bus) };
    },
  );

  // DELETE /api/v1/buses/:id — delete a bus
  app.delete(
    '/api/v1/buses/:id',
    { preHandler: [app.authenticate, requireProvider] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const providerId = request.user.providerId!;

      await busService.delete(id, providerId);

      return reply.status(204).send();
    },
  );
}

export default fp(busRoutes, {
  name: 'bus-routes',
  dependencies: ['auth'],
});
