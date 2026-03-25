import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { AdminService } from '@/application/services/admin.service.js';
import type { AdminUserEntity } from '@/application/services/admin.service.js';
import type { BusEntity } from '@/domain/buses/bus.entity.js';
import type { SeatEntity } from '@/domain/buses/bus.entity.js';
import type { AuditLogEntity } from '@/domain/audit/audit.entity.js';
import { AuditActions } from '@/domain/audit/audit-actions.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireAdmin } from '@/api/plugins/role-guard.js';
import { idParamSchema } from '@/shared/schemas.js';
import {
  adminListBusesQuerySchema,
  toggleSeatBodySchema,
  adminListUsersQuerySchema,
  updateUserStatusBodySchema,
  adminListAuditLogsQuerySchema,
} from '@/api/admin/schemas.js';

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
 * Serialize an AdminUserEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeUser(user: AdminUserEntity): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    providerId: user.providerId,
    status: user.status,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Serialize an AuditLogEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeAuditLog(log: AuditLogEntity): Record<string, unknown> {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  };
}

/** Map status action to the corresponding audit action. */
const auditActionMap = {
  suspend: AuditActions.ACCOUNT_SUSPENDED,
  unsuspend: AuditActions.ACCOUNT_UNSUSPENDED,
  unlock: AuditActions.ACCOUNT_UNLOCKED,
} as const;

/**
 * Register admin endpoints: user management, audit logs, buses, seats, and sessions.
 * All endpoints require ADMIN role.
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

  // GET /api/v1/admin/users — list all users (paginated, optional role/status filter)
  app.get(
    '/api/v1/admin/users',
    { preHandler: [app.authenticate, requireAdmin] },
    async (request) => {
      const query = adminListUsersQuerySchema.parse(request.query);
      const result = await adminService.listUsers(query);

      return {
        data: result.data.map(serializeUser),
        meta: result.meta,
      };
    },
  );

  // PATCH /api/v1/admin/users/:id/status — update user account status
  app.patch(
    '/api/v1/admin/users/:id/status',
    { preHandler: [app.authenticate, requireAdmin] },
    async (request) => {
      const { id } = idParamSchema.parse(request.params);
      const { action } = updateUserStatusBodySchema.parse(request.body);
      const user = await adminService.updateUserStatus(id, action);

      request.audit(auditActionMap[action], 'user', id);

      return { data: serializeUser(user) };
    },
  );

  // GET /api/v1/admin/audit-logs — list audit logs (paginated, optional filters)
  app.get(
    '/api/v1/admin/audit-logs',
    { preHandler: [app.authenticate, requireAdmin] },
    async (request) => {
      const query = adminListAuditLogsQuerySchema.parse(request.query);
      const result = await adminService.listAuditLogs(query);

      return {
        data: result.data.map(serializeAuditLog),
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

  // DELETE /api/v1/admin/users/:id/sessions — force logout user by revoking all refresh tokens
  app.delete(
    '/api/v1/admin/users/:id/sessions',
    { preHandler: [app.authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      await adminService.revokeAllSessions(id);

      return reply.status(204).send();
    },
  );
}

export default fp(adminRoutes, {
  name: 'admin-routes',
  dependencies: ['auth'],
});
