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
   * Compute total bookings, revenue, average occupancy, and per-route revenue.
   */
  async getAnalytics(providerId: string): Promise<ProviderAnalytics> {
    // Get all routes for this provider
    const routes = await this.prisma.route.findMany({
      where: { providerId },
      select: { id: true, name: true },
    });

    const routeIds = routes.map((r) => r.id);

    if (routeIds.length === 0) {
      return { totalBookings: 0, totalRevenue: 0, averageOccupancy: 0, revenueByRoute: [] };
    }

    // Total confirmed bookings and revenue
    const bookingAgg = await this.prisma.booking.aggregate({
      where: {
        schedule: { routeId: { in: routeIds } },
        status: 'CONFIRMED',
      },
      _count: { id: true },
      _sum: { totalPrice: true },
    });

    const totalBookings = bookingAgg._count.id;
    const totalRevenue = Math.round((bookingAgg._sum.totalPrice ?? 0) * 100) / 100;

    // Average occupancy: total booked seats / total capacity across active schedules
    const schedules = await this.prisma.schedule.findMany({
      where: { routeId: { in: routeIds }, status: 'ACTIVE' },
      select: {
        id: true,
        tripDate: true,
        bus: { select: { capacity: true } },
      },
    });

    let totalCapacity = 0;
    let totalBooked = 0;

    if (schedules.length > 0) {
      totalCapacity = schedules.reduce((sum, s) => sum + s.bus.capacity, 0);

      const bookedCounts = await this.prisma.booking.groupBy({
        by: ['scheduleId'],
        where: {
          scheduleId: { in: schedules.map((s) => s.id) },
          status: 'CONFIRMED',
        },
        _count: { id: true },
      });

      totalBooked = bookedCounts.reduce((sum, b) => sum + b._count.id, 0);
    }

    const averageOccupancy =
      totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) / 100 : 0;

    // Revenue by route
    const routeMap = new Map(routes.map((r) => [r.id, r.name]));
    const revenueByRouteAgg = await this.prisma.booking.groupBy({
      by: ['scheduleId'],
      where: {
        schedule: { routeId: { in: routeIds } },
        status: 'CONFIRMED',
      },
      _sum: { totalPrice: true },
    });

    // Map scheduleId → routeId
    const scheduleRouteMap = new Map<string, string>();
    const allSchedules = await this.prisma.schedule.findMany({
      where: { routeId: { in: routeIds } },
      select: { id: true, routeId: true },
    });
    for (const s of allSchedules) {
      scheduleRouteMap.set(s.id, s.routeId);
    }

    const routeRevenue = new Map<string, number>();
    for (const agg of revenueByRouteAgg) {
      const routeId = scheduleRouteMap.get(agg.scheduleId);
      if (routeId) {
        routeRevenue.set(routeId, (routeRevenue.get(routeId) ?? 0) + (agg._sum.totalPrice ?? 0));
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
