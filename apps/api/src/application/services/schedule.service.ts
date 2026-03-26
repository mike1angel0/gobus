import type { PrismaClient, Schedule, StopTime, Route, Bus } from '@/generated/prisma/client.js';
import type {
  ScheduleEntity,
  ScheduleWithDetails,
  StopTimeEntity,
  ScheduleRouteSummary,
  ScheduleBusSummary,
  ScheduleDriverSummary,
  CreateScheduleData,
  UpdateScheduleData,
  ScheduleStatus,
} from '@/domain/schedules/schedule.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { verifyOwnership } from '@/domain/errors/ownership.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('ScheduleService');

/** Pagination input for listing schedules. */
export interface SchedulePaginationInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
}

/** Optional filters for listing schedules. */
export interface ScheduleFilters {
  /** Filter by route identifier. */
  routeId?: string;
  /** Filter by bus identifier. */
  busId?: string;
  /** Filter by schedule status. */
  status?: ScheduleStatus;
  /** Filter schedules on or after this date. */
  fromDate?: Date;
  /** Filter schedules on or before this date. */
  toDate?: Date;
}

/** Result of listing schedules with pagination metadata. */
export interface PaginatedSchedules {
  /** List of schedules for the current page. */
  data: ScheduleEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/** Prisma Schedule with all related data for detail conversion. */
type ScheduleWithRelations = Schedule & {
  stopTimes: StopTime[];
  route: Route;
  bus: Bus;
  driver: { id: string; name: string } | null;
};

/**
 * Service handling schedule CRUD operations with ownership enforcement.
 * All operations scope schedules to the authenticated provider via route ownership.
 */
export class ScheduleService {
  /** Create a schedule service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List schedules belonging to a provider with pagination and optional filters.
   * Filter by routeId, busId, status, and date range.
   * Return schedules ordered by trip date (newest first).
   */
  async listByProvider(
    providerId: string,
    pagination: SchedulePaginationInput,
    filters: ScheduleFilters = {},
  ): Promise<PaginatedSchedules> {
    const { skip, take } = parsePagination(pagination.page, pagination.pageSize);

    const where = this.buildWhereClause(providerId, filters);

    const [schedules, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        orderBy: { tripDate: 'desc' },
        skip,
        take,
        select: {
          id: true,
          routeId: true,
          busId: true,
          driverId: true,
          departureTime: true,
          arrivalTime: true,
          daysOfWeek: true,
          basePrice: true,
          status: true,
          tripDate: true,
          createdAt: true,
        },
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return {
      data: schedules.map((s) => this.toScheduleEntity(s)),
      meta: buildPaginationMeta({ total, page: pagination.page, pageSize: pagination.pageSize }),
    };
  }

  /**
   * Retrieve a schedule by ID with ownership check.
   * Return the schedule with full details (route, bus, driver, stopTimes).
   * Throw NOT_FOUND if the schedule does not exist or belongs to another provider.
   */
  async getById(id: string, providerId: string): Promise<ScheduleWithDetails> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        stopTimes: { orderBy: { orderIndex: 'asc' } },
        route: true,
        bus: true,
        driver: { select: { id: true, name: true } },
      },
    });

    verifyOwnership(schedule, schedule?.route?.providerId, providerId, 'Schedule');

    return this.toScheduleWithDetails(schedule);
  }

  /**
   * Create a new schedule with stop times in a single transaction.
   * Validate that the route and bus belong to the provider.
   * Optionally validate that the driver belongs to the same provider.
   * Return the created schedule with full details.
   */
  async create(providerId: string, data: CreateScheduleData): Promise<ScheduleWithDetails> {
    const validations: Promise<void>[] = [
      this.validateRouteOwnership(data.routeId, providerId),
      this.validateBusOwnership(data.busId, providerId),
    ];
    if (data.driverId) {
      validations.push(this.validateDriverOwnership(data.driverId, providerId));
    }
    await Promise.all(validations);

    const schedule = await this.prisma.$transaction(async (tx) => {
      return tx.schedule.create({
        data: {
          routeId: data.routeId,
          busId: data.busId,
          driverId: data.driverId ?? null,
          departureTime: data.departureTime,
          arrivalTime: data.arrivalTime,
          daysOfWeek: data.daysOfWeek ?? [],
          basePrice: data.basePrice,
          tripDate: data.tripDate,
          stopTimes: {
            create: data.stopTimes.map((st) => ({
              stopName: st.stopName,
              arrivalTime: st.arrivalTime,
              departureTime: st.departureTime,
              orderIndex: st.orderIndex,
              priceFromStart: st.priceFromStart,
              lat: st.lat ?? null,
              lng: st.lng ?? null,
            })),
          },
        },
        include: {
          stopTimes: { orderBy: { orderIndex: 'asc' } },
          route: true,
          bus: true,
          driver: { select: { id: true, name: true } },
        },
      });
    });

    logger.info('Schedule created', { scheduleId: schedule.id, providerId });

    return this.toScheduleWithDetails(schedule);
  }

  /**
   * Update a schedule by ID with ownership check.
   * Support updating driver assignment, status, and times.
   * Validate driver belongs to same provider when assigning.
   * Throw NOT_FOUND if the schedule does not exist or belongs to another provider.
   */
  async update(
    id: string,
    providerId: string,
    data: UpdateScheduleData,
  ): Promise<ScheduleWithDetails> {
    const existing = await this.prisma.schedule.findUnique({
      where: { id },
      include: { route: { select: { providerId: true } } },
    });

    verifyOwnership(existing, existing?.route?.providerId, providerId, 'Schedule');

    if (data.driverId !== undefined && data.driverId !== null) {
      await this.validateDriverOwnership(data.driverId, providerId);
    }

    const updateData: Record<string, unknown> = {};
    if (data.driverId !== undefined) updateData.driverId = data.driverId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.departureTime !== undefined) updateData.departureTime = data.departureTime;
    if (data.arrivalTime !== undefined) updateData.arrivalTime = data.arrivalTime;

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        stopTimes: { orderBy: { orderIndex: 'asc' } },
        route: true,
        bus: true,
        driver: { select: { id: true, name: true } },
      },
    });

    logger.info('Schedule updated', { scheduleId: id, providerId });

    return this.toScheduleWithDetails(updated);
  }

  /**
   * Cancel a schedule by ID with ownership check.
   * Set the schedule status to CANCELLED.
   * Throw NOT_FOUND if the schedule does not exist or belongs to another provider.
   */
  async cancel(id: string, providerId: string): Promise<void> {
    const existing = await this.prisma.schedule.findUnique({
      where: { id },
      include: { route: { select: { providerId: true } } },
    });

    verifyOwnership(existing, existing?.route?.providerId, providerId, 'Schedule');

    await this.prisma.schedule.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    logger.info('Schedule cancelled', { scheduleId: id, providerId });
  }

  /**
   * Validate that a route exists and belongs to the given provider.
   * Throw NOT_FOUND if the route does not exist or belongs to another provider.
   */
  private async validateRouteOwnership(routeId: string, providerId: string): Promise<void> {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      select: { providerId: true },
    });

    verifyOwnership(route, route?.providerId, providerId, 'Route');
  }

  /**
   * Validate that a bus exists and belongs to the given provider.
   * Throw NOT_FOUND if the bus does not exist or belongs to another provider.
   */
  private async validateBusOwnership(busId: string, providerId: string): Promise<void> {
    const bus = await this.prisma.bus.findUnique({
      where: { id: busId },
      select: { providerId: true },
    });

    verifyOwnership(bus, bus?.providerId, providerId, 'Bus');
  }

  /**
   * Validate that a driver exists, has DRIVER role, and belongs to the given provider.
   * Throw NOT_FOUND if the driver does not exist, is not a driver, or belongs to another provider.
   */
  private async validateDriverOwnership(driverId: string, providerId: string): Promise<void> {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: { providerId: true, role: true, deletedAt: true },
    });

    if (!driver || driver.role !== 'DRIVER' || driver.providerId !== providerId || driver.deletedAt) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Driver not found');
    }
  }

  /**
   * Build Prisma where clause for listing schedules with filters.
   * Scope to provider via route relationship.
   */
  private buildWhereClause(providerId: string, filters: ScheduleFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {
      route: { providerId },
    };

    if (filters.routeId) where.routeId = filters.routeId;
    if (filters.busId) where.busId = filters.busId;
    if (filters.status) where.status = filters.status;

    if (filters.fromDate || filters.toDate) {
      const tripDate: Record<string, Date> = {};
      if (filters.fromDate) tripDate.gte = filters.fromDate;
      if (filters.toDate) tripDate.lte = filters.toDate;
      where.tripDate = tripDate;
    }

    return where;
  }

  /** Convert a Prisma Schedule record to a ScheduleEntity. */
  private toScheduleEntity(schedule: Schedule): ScheduleEntity {
    return {
      id: schedule.id,
      routeId: schedule.routeId,
      busId: schedule.busId,
      driverId: schedule.driverId,
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      daysOfWeek: schedule.daysOfWeek,
      basePrice: schedule.basePrice,
      status: schedule.status as ScheduleStatus,
      tripDate: schedule.tripDate,
      createdAt: schedule.createdAt,
    };
  }

  /** Convert a Prisma Schedule with relations to a ScheduleWithDetails entity. */
  private toScheduleWithDetails(schedule: ScheduleWithRelations): ScheduleWithDetails {
    return {
      ...this.toScheduleEntity(schedule),
      stopTimes: schedule.stopTimes.map((st) => this.toStopTimeEntity(st)),
      route: this.toRouteSummary(schedule.route),
      bus: this.toBusSummary(schedule.bus),
      driver: schedule.driver ? this.toDriverSummary(schedule.driver) : null,
    };
  }

  /** Convert a Prisma StopTime record to a StopTimeEntity. */
  private toStopTimeEntity(stopTime: StopTime): StopTimeEntity {
    return {
      id: stopTime.id,
      stopName: stopTime.stopName,
      arrivalTime: stopTime.arrivalTime,
      departureTime: stopTime.departureTime,
      orderIndex: stopTime.orderIndex,
      priceFromStart: stopTime.priceFromStart,
      lat: stopTime.lat,
      lng: stopTime.lng,
    };
  }

  /** Convert a Prisma Route record to a ScheduleRouteSummary. */
  private toRouteSummary(route: Route): ScheduleRouteSummary {
    return {
      id: route.id,
      name: route.name,
      providerId: route.providerId,
      createdAt: route.createdAt,
    };
  }

  /** Convert a Prisma Bus record to a ScheduleBusSummary. */
  private toBusSummary(bus: Bus): ScheduleBusSummary {
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

  /** Convert a driver record to a ScheduleDriverSummary. */
  private toDriverSummary(driver: { id: string; name: string }): ScheduleDriverSummary {
    return {
      id: driver.id,
      name: driver.name,
    };
  }
}
