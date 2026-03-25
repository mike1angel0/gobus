import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { AdminService } from '@/application/services/admin.service.js';
import type { BusEntity } from '@/domain/buses/bus.entity.js';
import type { SeatEntity } from '@/domain/buses/bus.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireAdmin } from '@/api/plugins/role-guard.js';
import { idParamSchema } from '@/shared/schemas.js';
import { adminListBusesQuerySchema, toggleSeatBodySchema } from '@/api/admin/schemas.js';

/**
 * Serialize a BusEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeBus(bus: BusEntity): Record<string, unknown> {
  return {
    id: bus.id,
    licensePlate: bus.licensePlate,
    model: bus.model,
    capacity: bus.capacity,
    rows: bus.rows,
    columns: bus.columns,
    providerId: bus.providerId,
    createdAt: bus.createdAt.toISOString(),
  };
}

/**
 * Serialize a SeatEntity to a JSON-safe response object.
 * All fields are already JSON-safe primitives.
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
 * Register admin endpoints: GET /api/v1/admin/buses and PATCH /api/v1/admin/seats/:id.
 * Both endpoints require ADMIN role.
 */
async function adminRoutes(app: FastifyInstance): Promise<void> {
  const adminService = new AdminService(getPrisma());

  // GET /api/v1/admin/buses — list all buses (paginated, optional provider filter)
  app.get(
    '/api/v1/admin/buses',
    { preHandler: [app.authenticate, requireAdmin] },
    async (request) => {
      const query = adminListBusesQuerySchema.parse(request.query);
      const result = await adminService.listAllBuses(query);

      return {
        data: result.data.map(serializeBus),
        meta: result.meta,
      };
    },
  );

  // PATCH /api/v1/admin/seats/:id — toggle seat enabled/disabled
  app.patch(
    '/api/v1/admin/seats/:id',
    { preHandler: [app.authenticate, requireAdmin] },
    async (request) => {
      const { id } = idParamSchema.parse(request.params);
      const { isEnabled } = toggleSeatBodySchema.parse(request.body);
      const seat = await adminService.toggleSeat(id, isEnabled);

      return { data: serializeSeat(seat) };
    },
  );
}

export default fp(adminRoutes, {
  name: 'admin-routes',
  dependencies: ['auth'],
});
