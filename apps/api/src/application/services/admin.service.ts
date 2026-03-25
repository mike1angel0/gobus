import type { PrismaClient, Bus, Seat, AuditLog } from '@/generated/prisma/client.js';
import type { BusEntity, SeatEntity } from '@/domain/buses/bus.entity.js';
import type { AuditLogEntity } from '@/domain/audit/audit.entity.js';
import type { AuditAction } from '@/domain/audit/audit-actions.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('AdminService');

/** User entity with admin-visible fields including security info. */
export interface AdminUserEntity {
  /** Unique user identifier (cuid). */
  id: string;
  /** User email address. */
  email: string;
  /** User display name. */
  name: string;
  /** User role. */
  role: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  /** User phone number. */
  phone: string | null;
  /** User avatar URL. */
  avatarUrl: string | null;
  /** Associated provider ID. */
  providerId: string | null;
  /** Account status. */
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  /** Number of consecutive failed login attempts. */
  failedLoginAttempts: number;
  /** Account locked until this timestamp. */
  lockedUntil: Date | null;
  /** Account creation timestamp. */
  createdAt: Date;
  /** Last update timestamp. */
  updatedAt: Date;
}

/** Pagination and filter input for listing all buses. */
export interface AdminListBusesInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Optional provider ID to filter buses. */
  providerId?: string;
}

/** Pagination and filter input for listing all users. */
export interface AdminListUsersInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Optional role filter. */
  role?: string;
  /** Optional status filter. */
  status?: string;
}

/** Pagination and filter input for listing audit logs. */
export interface AdminListAuditLogsInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Optional user ID filter. */
  userId?: string;
  /** Optional action filter. */
  action?: string;
  /** Optional date-from filter (ISO string). */
  dateFrom?: string;
  /** Optional date-to filter (ISO string). */
  dateTo?: string;
}

/** Result of listing all buses with pagination metadata. */
export interface PaginatedAdminBuses {
  /** List of buses for the current page. */
  data: BusEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/** Result of listing all users with pagination metadata. */
export interface PaginatedAdminUsers {
  /** List of users for the current page. */
  data: AdminUserEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/** Result of listing audit logs with pagination metadata. */
export interface PaginatedAdminAuditLogs {
  /** List of audit logs for the current page. */
  data: AuditLogEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Service handling admin operations across all providers.
 * All operations require ADMIN role (enforced at route level).
 */
export class AdminService {
  /** Create an admin service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List all buses across all providers with optional provider filter.
   * Return buses ordered by creation date (newest first).
   */
  async listAllBuses(input: AdminListBusesInput): Promise<PaginatedAdminBuses> {
    const { skip, take } = parsePagination(input.page, input.pageSize);
    const where = input.providerId ? { providerId: input.providerId } : {};

    const [buses, total] = await Promise.all([
      this.prisma.bus.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          licensePlate: true,
          model: true,
          capacity: true,
          rows: true,
          columns: true,
          providerId: true,
          createdAt: true,
        },
      }),
      this.prisma.bus.count({ where }),
    ]);

    logger.debug('Listed all buses', { total, page: input.page });

    return {
      data: buses.map((b) => toBusEntity(b)),
      meta: buildPaginationMeta({ total, page: input.page, pageSize: input.pageSize }),
    };
  }

  /**
   * List all users with optional role and status filters.
   * Return users ordered by creation date (newest first).
   */
  async listUsers(input: AdminListUsersInput): Promise<PaginatedAdminUsers> {
    const { skip, take } = parsePagination(input.page, input.pageSize);
    const where: Record<string, unknown> = {};

    if (input.role) {
      where.role = input.role;
    }
    if (input.status) {
      where.status = input.status;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          avatarUrl: true,
          providerId: true,
          status: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    logger.debug('Listed all users', { total, page: input.page });

    return {
      data: users.map((u) => toAdminUserEntity(u)),
      meta: buildPaginationMeta({ total, page: input.page, pageSize: input.pageSize }),
    };
  }

  /**
   * Update user account status: suspend, unsuspend, or unlock.
   * Suspending also revokes all active refresh tokens.
   * Throw RESOURCE_NOT_FOUND if user does not exist.
   */
  async updateUserStatus(
    userId: string,
    action: 'suspend' | 'unsuspend' | 'unlock',
  ): Promise<AdminUserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');
    }

    let updateData: Record<string, unknown>;

    switch (action) {
      case 'suspend':
        updateData = { status: 'SUSPENDED' };
        break;
      case 'unsuspend':
        updateData = { status: 'ACTIVE' };
        break;
      case 'unlock':
        updateData = {
          status: 'ACTIVE',
          failedLoginAttempts: 0,
          lockedUntil: null,
        };
        break;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatarUrl: true,
        providerId: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (action === 'suspend') {
      await this.revokeAllSessions(userId);
    }

    logger.info('User status updated', { userId, action, newStatus: updated.status });

    return toAdminUserEntity(updated);
  }

  /**
   * List audit logs with optional filters by user, action, and date range.
   * Return logs ordered by creation date (newest first).
   */
  async listAuditLogs(input: AdminListAuditLogsInput): Promise<PaginatedAdminAuditLogs> {
    const { skip, take } = parsePagination(input.page, input.pageSize);
    const where: Record<string, unknown> = {};

    if (input.userId) {
      where.userId = input.userId;
    }
    if (input.action) {
      where.action = input.action;
    }
    if (input.dateFrom || input.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (input.dateFrom) {
        createdAt.gte = new Date(input.dateFrom);
      }
      if (input.dateTo) {
        createdAt.lte = new Date(input.dateTo);
      }
      where.createdAt = createdAt;
    }

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    logger.debug('Listed audit logs', { total, page: input.page });

    return {
      data: records.map((r) => toAuditLogEntity(r)),
      meta: buildPaginationMeta({ total, page: input.page, pageSize: input.pageSize }),
    };
  }

  /**
   * Revoke all active refresh tokens for a user, forcing logout of all sessions.
   * Return the number of revoked tokens. Throw RESOURCE_NOT_FOUND if user does not exist.
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');
    }

    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    logger.info('All sessions revoked for user', { userId, revokedCount: result.count });

    return result.count;
  }

  /**
   * Toggle the enabled status of a seat.
   * Return the updated seat entity.
   * Throw RESOURCE_NOT_FOUND if the seat does not exist.
   */
  async toggleSeat(seatId: string, isEnabled: boolean): Promise<SeatEntity> {
    const seat = await this.prisma.seat.findUnique({
      where: { id: seatId },
      select: { id: true },
    });

    if (!seat) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Seat not found');
    }

    const updated = await this.prisma.seat.update({
      where: { id: seatId },
      data: { isEnabled },
    });

    logger.info('Seat toggled', { seatId, isEnabled });

    return toSeatEntity(updated);
  }
}

/** Convert a Prisma Bus record to a BusEntity. */
function toBusEntity(bus: Bus): BusEntity {
  return {
    id: bus.id,
    licensePlate: bus.licensePlate,
    model: bus.model,
    capacity: bus.capacity,
    rows: bus.rows,
    columns: bus.columns,
    providerId: bus.providerId,
    createdAt: bus.createdAt,
  };
}

/** Convert a Prisma Seat record to a SeatEntity. */
function toSeatEntity(seat: Seat): SeatEntity {
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

/** Convert a Prisma User record (with select fields) to an AdminUserEntity. */
function toAdminUserEntity(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatarUrl: string | null;
  providerId: string | null;
  status: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminUserEntity {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AdminUserEntity['role'],
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    providerId: user.providerId,
    status: user.status as AdminUserEntity['status'],
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Convert a Prisma AuditLog record to an AuditLogEntity. */
function toAuditLogEntity(record: AuditLog): AuditLogEntity {
  return {
    id: record.id,
    userId: record.userId,
    action: record.action as AuditAction,
    resource: record.resource,
    resourceId: record.resourceId,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    metadata: record.metadata as Record<string, unknown> | null,
    createdAt: record.createdAt,
  };
}
