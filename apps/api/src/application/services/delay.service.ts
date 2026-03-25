import type { PrismaClient } from '@/generated/prisma/client.js';
import type { DelayData } from '@/domain/delays/delay.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('DelayService');

/** Input for creating a new delay report. */
export interface CreateDelayInput {
  /** Schedule to report delay for. */
  scheduleId: string;
  /** Delay duration in minutes. */
  offsetMinutes: number;
  /** Reason for the delay. */
  reason: 'TRAFFIC' | 'MECHANICAL' | 'WEATHER' | 'OTHER';
  /** Optional free-text note about the delay. */
  note?: string;
  /** Trip date in ISO 8601 date format (YYYY-MM-DD). */
  tripDate: string;
}

/** Input for updating an existing delay. */
export interface UpdateDelayInput {
  /** Updated delay duration in minutes. */
  offsetMinutes?: number;
  /** Updated reason for the delay. */
  reason?: 'TRAFFIC' | 'MECHANICAL' | 'WEATHER' | 'OTHER';
  /** Updated free-text note about the delay. */
  note?: string | null;
  /** Whether the delay is currently active. */
  active?: boolean;
}

/** Paginated delay results. */
export interface PaginatedDelays {
  /** List of delays for the current page. */
  data: DelayData[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/** User context needed for authorization checks. */
export interface DelayUser {
  /** User's unique identifier. */
  id: string;
  /** User's role. */
  role: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  /** Associated provider ID (for PROVIDER and DRIVER roles). */
  providerId: string | null;
}

/**
 * Map a Prisma Delay record to a DelayData entity.
 * Extract only the fields needed for the API response.
 */
function toDelayData(record: {
  id: string;
  scheduleId: string;
  offsetMinutes: number;
  reason: 'TRAFFIC' | 'MECHANICAL' | 'WEATHER' | 'OTHER';
  note: string | null;
  tripDate: Date;
  active: boolean;
  createdAt: Date;
}): DelayData {
  return {
    id: record.id,
    scheduleId: record.scheduleId,
    offsetMinutes: record.offsetMinutes,
    reason: record.reason,
    note: record.note,
    tripDate: record.tripDate,
    active: record.active,
    createdAt: record.createdAt,
  };
}

/**
 * Service handling delay reporting and management.
 * Provide delay creation for drivers and providers, and delay updates for providers.
 */
export class DelayService {
  /** Create a delay service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Retrieve active delays for a schedule on a specific trip date with pagination.
   * Return paginated delay records matching the schedule and date.
   */
  async getBySchedule(
    scheduleId: string,
    tripDate: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedDelays> {
    const tripDateObj = new Date(tripDate);
    const { skip, take } = parsePagination(page, pageSize);
    const where = { scheduleId, tripDate: tripDateObj, active: true };

    const [records, total] = await Promise.all([
      this.prisma.delay.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.delay.count({ where }),
    ]);

    logger.debug('Delays retrieved', { scheduleId, tripDate, count: records.length, total });

    return {
      data: records.map(toDelayData),
      meta: buildPaginationMeta({ total, page, pageSize }),
    };
  }

  /**
   * Create a new delay report for a schedule on a specific trip date.
   * Validate that the user is a driver assigned to the schedule or a provider owning the schedule.
   * Deactivate previous active delays for the same schedule+tripDate atomically.
   */
  async create(user: DelayUser, input: CreateDelayInput): Promise<DelayData> {
    const { scheduleId, offsetMinutes, reason, note, tripDate } = input;
    const tripDateObj = new Date(tripDate);

    // Validate schedule exists and get provider info
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { route: { select: { providerId: true } } },
    });

    if (!schedule) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
    }

    // Authorization: driver must be assigned, provider must own the schedule
    if (user.role === 'DRIVER') {
      if (schedule.driverId !== user.id) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Not assigned to this schedule');
      }
    } else if (user.role === 'PROVIDER') {
      if (schedule.route.providerId !== user.providerId) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
      }
    } else {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only drivers and providers can report delays');
    }

    // Atomically deactivate previous delays and create new one
    const record = await this.prisma.$transaction(async (tx) => {
      // Deactivate all active delays for this schedule+tripDate
      await tx.delay.updateMany({
        where: { scheduleId, tripDate: tripDateObj, active: true },
        data: { active: false },
      });

      // Create new active delay
      return tx.delay.create({
        data: {
          scheduleId,
          offsetMinutes,
          reason,
          note: note ?? null,
          tripDate: tripDateObj,
          active: true,
        },
      });
    });

    logger.info('Delay created', {
      delayId: record.id,
      scheduleId,
      userId: user.id,
      offsetMinutes,
      reason,
    });

    return toDelayData(record);
  }

  /**
   * Update an existing delay record.
   * Restricted to PROVIDER role. Validate provider owns the schedule associated with the delay.
   * Return 404 if delay not found or not owned by provider (prevents enumeration).
   */
  async update(id: string, providerId: string, input: UpdateDelayInput): Promise<DelayData> {
    // Fetch delay with schedule's provider info
    const delay = await this.prisma.delay.findUnique({
      where: { id },
      include: { schedule: { include: { route: { select: { providerId: true } } } } },
    });

    if (!delay) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Delay not found');
    }

    // Ownership check: provider must own the schedule
    if (delay.schedule.route.providerId !== providerId) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Delay not found');
    }

    const record = await this.prisma.delay.update({
      where: { id },
      data: {
        ...(input.offsetMinutes !== undefined && { offsetMinutes: input.offsetMinutes }),
        ...(input.reason !== undefined && { reason: input.reason }),
        ...(input.note !== undefined && { note: input.note }),
        ...(input.active !== undefined && { active: input.active }),
      },
    });

    logger.info('Delay updated', { delayId: id, providerId, changes: Object.keys(input) });

    return toDelayData(record);
  }
}
