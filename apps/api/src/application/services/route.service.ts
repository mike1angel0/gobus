import type { PrismaClient, Route, Stop } from '@/generated/prisma/client.js';
import type {
  RouteEntity,
  RouteWithStops,
  StopEntity,
  CreateRouteData,
} from '@/domain/routes/route.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { verifyOwnership } from '@/domain/errors/ownership.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('RouteService');

/** Pagination input for listing routes. */
export interface RoutePaginationInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
}

/** Result of listing routes with pagination metadata. */
export interface PaginatedRoutes {
  /** List of routes for the current page. */
  data: RouteEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Service handling route CRUD operations with ownership enforcement.
 * All operations scope routes to the authenticated provider.
 */
export class RouteService {
  /** Create a route service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List routes belonging to a provider with pagination.
   * Returns routes ordered by creation date (newest first).
   */
  async listByProvider(
    providerId: string,
    pagination: RoutePaginationInput,
  ): Promise<PaginatedRoutes> {
    const { skip, take } = parsePagination(pagination.page, pagination.pageSize);

    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({
        where: { providerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: { id: true, name: true, providerId: true, createdAt: true },
      }),
      this.prisma.route.count({ where: { providerId } }),
    ]);

    return {
      data: routes.map((r) => this.toRouteEntity(r)),
      meta: buildPaginationMeta({ total, page: pagination.page, pageSize: pagination.pageSize }),
    };
  }

  /**
   * Retrieve a route by ID with ownership check.
   * Returns the route with its ordered stops.
   * Throws NOT_FOUND if the route does not exist or belongs to another provider.
   */
  async getById(id: string, providerId: string): Promise<RouteWithStops> {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: { stops: { orderBy: { orderIndex: 'asc' } } },
    });

    verifyOwnership(route, route?.providerId, providerId, 'Route');

    return this.toRouteWithStops(route);
  }

  /**
   * Create a new route with its stops in a single transaction.
   * Returns the created route with stops.
   */
  async create(providerId: string, data: CreateRouteData): Promise<RouteWithStops> {
    const route = await this.prisma.$transaction(async (tx) => {
      const created = await tx.route.create({
        data: {
          name: data.name,
          providerId,
          stops: {
            create: data.stops.map((stop) => ({
              name: stop.name,
              lat: stop.lat,
              lng: stop.lng,
              orderIndex: stop.orderIndex,
              stationId: stop.stationId ?? null,
            })),
          },
        },
        include: { stops: { orderBy: { orderIndex: 'asc' } } },
      });

      return created;
    });

    logger.info('Route created', { routeId: route.id, providerId });

    return this.toRouteWithStops(route);
  }

  /**
   * Delete a route by ID with ownership check.
   * Verifies no active schedules reference the route before deletion.
   * Throws NOT_FOUND if the route does not exist or belongs to another provider.
   * Throws CONFLICT if active schedules reference the route.
   */
  async delete(id: string, providerId: string): Promise<void> {
    const route = await this.prisma.route.findUnique({
      where: { id },
      select: { providerId: true },
    });

    verifyOwnership(route, route?.providerId, providerId, 'Route');

    const activeScheduleCount = await this.prisma.schedule.count({
      where: { routeId: id, status: 'ACTIVE' },
    });

    if (activeScheduleCount > 0) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Cannot delete route with active schedules');
    }

    await this.prisma.route.delete({ where: { id } });

    logger.info('Route deleted', { routeId: id, providerId });
  }

  /** Convert a Prisma Route record to a RouteEntity. */
  private toRouteEntity(route: Route): RouteEntity {
    return {
      id: route.id,
      name: route.name,
      providerId: route.providerId,
      createdAt: route.createdAt,
    };
  }

  /** Convert a Prisma Route with stops to a RouteWithStops entity. */
  private toRouteWithStops(route: Route & { stops: Stop[] }): RouteWithStops {
    return {
      id: route.id,
      name: route.name,
      providerId: route.providerId,
      createdAt: route.createdAt,
      stops: route.stops.map((s) => this.toStopEntity(s)),
    };
  }

  /** Convert a Prisma Stop record to a StopEntity. */
  private toStopEntity(stop: Stop): StopEntity {
    return {
      id: stop.id,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
      orderIndex: stop.orderIndex,
    };
  }
}
