import bcrypt from 'bcryptjs';
import type { PrismaClient, User } from '@/generated/prisma/client.js';
import type { DriverEntity, CreateDriverData } from '@/domain/drivers/driver.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('DriverService');

const BCRYPT_ROUNDS = 12;

/** Pagination input for listing drivers. */
export interface DriverPaginationInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
}

/** Result of listing drivers with pagination metadata. */
export interface PaginatedDrivers {
  /** List of drivers for the current page. */
  data: DriverEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Service handling driver CRUD operations with ownership enforcement.
 * All operations scope drivers to the authenticated provider.
 */
export class DriverService {
  /** Create a driver service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List drivers belonging to a provider with pagination.
   * Include assigned schedule count per driver.
   * Return drivers ordered by creation date (newest first).
   */
  async listByProvider(
    providerId: string,
    pagination: DriverPaginationInput,
  ): Promise<PaginatedDrivers> {
    const { skip, take } = parsePagination(pagination.page, pagination.pageSize);

    const where = { providerId, role: 'DRIVER' as const };

    const [drivers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          _count: {
            select: { driverSchedules: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: drivers.map((d) => this.toDriverEntity(d, d._count.driverSchedules)),
      meta: buildPaginationMeta({ total, page: pagination.page, pageSize: pagination.pageSize }),
    };
  }

  /**
   * Create a new driver account under the given provider.
   * Hash the password, set role to DRIVER, and link to provider.
   * Throw CONFLICT (409) if the email is already in use.
   */
  async create(providerId: string, data: CreateDriverData): Promise<DriverEntity> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(409, ErrorCodes.AUTH_EMAIL_TAKEN, 'Email address is already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: 'DRIVER',
        phone: data.phone ?? null,
        providerId,
      },
    });

    logger.info('Driver created', { driverId: user.id, providerId });

    return this.toDriverEntity(user, 0);
  }

  /**
   * Delete a driver by ID with ownership check.
   * Unassign the driver from all schedules before deletion.
   * Throw NOT_FOUND if the driver does not exist or belongs to another provider.
   */
  async delete(id: string, providerId: string): Promise<void> {
    const driver = await this.prisma.user.findUnique({
      where: { id },
      select: { providerId: true, role: true },
    });

    if (!driver || driver.role !== 'DRIVER' || driver.providerId !== providerId) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Driver not found');
    }

    // Unassign from all schedules, then delete
    await this.prisma.$transaction([
      this.prisma.schedule.updateMany({
        where: { driverId: id },
        data: { driverId: null },
      }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    logger.info('Driver deleted', { driverId: id, providerId });
  }

  /** Convert a Prisma User record to a DriverEntity. */
  private toDriverEntity(user: User, assignedScheduleCount: number): DriverEntity {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'DRIVER',
      phone: user.phone,
      status: user.status,
      providerId: user.providerId!,
      assignedScheduleCount,
      createdAt: user.createdAt,
    };
  }
}
