import type { PrismaClient } from '@/generated/prisma/client.js';
import type { PaginationMeta } from '@/shared/types.js';
import type { AuditLogEntity, AuditLogInput } from '@/domain/audit/audit.entity.js';
import type { AuditAction } from '@/domain/audit/audit-actions.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('AuditService');

/** Paginated result for audit log queries. */
export interface PaginatedAuditLogs {
  data: AuditLogEntity[];
  meta: PaginationMeta;
}

/** Input for querying audit logs by user. */
export interface GetByUserInput {
  userId: string;
  page: number;
  pageSize: number;
}

/**
 * Convert a Prisma AuditLog record to an AuditLogEntity.
 * Maps the raw database row to the domain entity shape.
 */
function toAuditLogEntity(record: {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}): AuditLogEntity {
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

/**
 * Service for recording and querying audit log entries.
 * Provides fire-and-forget logging for security and business events,
 * and paginated queries for admin audit log viewing.
 */
export class AuditService {
  /** Create an AuditService with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Record an audit log entry in fire-and-forget mode.
   * Errors are caught and logged — the caller is never blocked.
   */
  log(input: AuditLogInput): void {
    try {
      this.prisma.auditLog
        .create({
          data: {
            userId: input.userId ?? null,
            action: input.action,
            resource: input.resource,
            resourceId: input.resourceId ?? null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            metadata: (input.metadata as Record<string, unknown> & object) ?? undefined,
          },
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('Failed to write audit log', {
            action: input.action,
            resource: input.resource,
            error: message,
          });
        });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to write audit log', {
        action: input.action,
        resource: input.resource,
        error: message,
      });
    }
  }

  /**
   * Retrieve paginated audit log entries for a specific user.
   * Results are ordered by creation date descending (newest first).
   */
  async getByUser(input: GetByUserInput): Promise<PaginatedAuditLogs> {
    const { skip, take } = parsePagination(input.page, input.pageSize);

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({
        where: { userId: input.userId },
      }),
    ]);

    return {
      data: records.map(toAuditLogEntity),
      meta: buildPaginationMeta({ total, page: input.page, pageSize: input.pageSize }),
    };
  }
}
