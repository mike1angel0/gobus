import type { PrismaClient, Provider } from '@/generated/prisma/client.js';
import type {
  ProviderAnalytics,
  ProviderEntity,
  ProviderUpdateData,
} from '@/domain/providers/provider.entity.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('ProviderService');

/**
 * Service handling provider profile operations including
 * lookup by ID, lookup by user, and profile updates.
 */
export class ProviderService {
  /** Create a provider service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Retrieve a provider by its unique ID.
   * Throws NOT_FOUND if the provider does not exist.
   */
  async getById(id: string): Promise<ProviderEntity> {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Provider not found');
    }

    return this.toEntity(provider);
  }

  /**
   * Resolve the provider profile for a user by their providerId.
   * Throws NOT_FOUND if the user has no associated provider.
   */
  async getByUserId(userId: string): Promise<ProviderEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { provider: true },
    });

    if (!user?.provider) {
      throw new AppError(
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
        'No provider associated with this user',
      );
    }

    return this.toEntity(user.provider);
  }

  /**
   * Update a provider's profile fields. Only provided fields are updated.
   * Returns the updated provider entity.
   */
  async updateProfile(providerId: string, data: ProviderUpdateData): Promise<ProviderEntity> {
    const existing = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!existing) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Provider not found');
    }

    const updated = await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.logo !== undefined && { logo: data.logo }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
      },
    });

    logger.info('Provider profile updated', { providerId });

    return this.toEntity(updated);
  }

  /**
   * Retrieve aggregated analytics for a provider's operations.
   * Wrap all queries in a read-only transaction for a consistent snapshot,
   * parallelize independent queries, and prefetch schedule→route mapping.
   */
  async getAnalytics(providerId: string): Promise<ProviderAnalytics> {
    return this.prisma.$transaction(async (tx) => {
      const routes = await tx.route.findMany({
        where: { providerId },
        select: { id: true, name: true },
      });

      const routeIds = routes.map((r) => r.id);

      if (routeIds.length === 0) {
        return { totalBookings: 0, totalRevenue: 0, averageOccupancy: 0, revenueByRoute: [] };
      }

      // Run independent queries in parallel
      const [bookingAgg, activeSchedules, revenueBySchedule] = await Promise.all([
        tx.booking.aggregate({
          where: { schedule: { routeId: { in: routeIds } }, status: 'CONFIRMED' },
          _count: { id: true },
          _sum: { totalPrice: true },
        }),
        tx.schedule.findMany({
          where: { routeId: { in: routeIds }, status: 'ACTIVE' },
          select: {
            id: true,
            routeId: true,
            bus: { select: { capacity: true } },
          },
        }),
        tx.booking.groupBy({
          by: ['scheduleId'],
          where: { schedule: { routeId: { in: routeIds } }, status: 'CONFIRMED' },
          _sum: { totalPrice: true },
        }),
      ]);

      const totalBookings = bookingAgg._count.id;
      const totalRevenue = Math.round((bookingAgg._sum.totalPrice ?? 0) * 100) / 100;

      // Average occupancy from active schedules
      let averageOccupancy = 0;
      if (activeSchedules.length > 0) {
        const totalCapacity = activeSchedules.reduce((sum, s) => sum + s.bus.capacity, 0);

        const bookedCounts = await tx.booking.groupBy({
          by: ['scheduleId'],
          where: {
            scheduleId: { in: activeSchedules.map((s) => s.id) },
            status: 'CONFIRMED',
          },
          _count: { id: true },
        });

        const totalBooked = bookedCounts.reduce((sum, b) => sum + b._count.id, 0);
        averageOccupancy =
          totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) / 100 : 0;
      }

      // Build schedule→route map from activeSchedules + fetch remaining schedules for revenue mapping
      const scheduleRouteMap = new Map<string, string>();
      for (const s of activeSchedules) {
        scheduleRouteMap.set(s.id, s.routeId);
      }

      // Find scheduleIds from revenueBySchedule that aren't already mapped
      const unmappedScheduleIds = revenueBySchedule
        .map((a) => a.scheduleId)
        .filter((id) => !scheduleRouteMap.has(id));

      if (unmappedScheduleIds.length > 0) {
        const extraSchedules = await tx.schedule.findMany({
          where: { id: { in: unmappedScheduleIds } },
          select: { id: true, routeId: true },
        });
        for (const s of extraSchedules) {
          scheduleRouteMap.set(s.id, s.routeId);
        }
      }

      // Aggregate revenue by route
      const routeRevenue = new Map<string, number>();
      for (const agg of revenueBySchedule) {
        const routeId = scheduleRouteMap.get(agg.scheduleId);
        if (routeId) {
          routeRevenue.set(
            routeId,
            (routeRevenue.get(routeId) ?? 0) + (agg._sum.totalPrice ?? 0),
          );
        }
      }

      const revenueByRoute = routes
        .map((r) => ({
          routeId: r.id,
          routeName: r.name,
          revenue: Math.round((routeRevenue.get(r.id) ?? 0) * 100) / 100,
        }))
        .filter((r) => r.revenue > 0);

      logger.debug('Provider analytics computed', { providerId, totalBookings, totalRevenue });

      return { totalBookings, totalRevenue, averageOccupancy, revenueByRoute };
    });
  }

  /**
   * Convert a Prisma Provider record to a public ProviderEntity.
   */
  private toEntity(provider: Provider): ProviderEntity {
    return {
      id: provider.id,
      name: provider.name,
      logo: provider.logo,
      contactEmail: provider.contactEmail,
      contactPhone: provider.contactPhone,
      status: provider.status,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
