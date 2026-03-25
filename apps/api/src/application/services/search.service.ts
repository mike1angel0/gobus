import type { PrismaClient } from '@/generated/prisma/client.js';
import type {
  SearchResult,
  TripDetail,
  SeatAvailability,
  TripStopTime,
} from '@/domain/search/search.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('SearchService');

/** Query parameters for searching trips. */
export interface SearchTripsQuery {
  /** Origin stop name (case-insensitive partial match). */
  origin: string;
  /** Destination stop name (case-insensitive partial match). */
  destination: string;
  /** Trip date (ISO 8601 date string, e.g. 2026-03-25). */
  date: string;
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
}

/** Result of searching trips with pagination metadata. */
export interface PaginatedSearchResults {
  /** List of search results for the current page. */
  data: SearchResult[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Compute the segment price between two stops based on their priceFromStart values.
 * Segment price = destination priceFromStart - origin priceFromStart.
 */
export function computeSegmentPrice(originPrice: number, destinationPrice: number): number {
  return Math.round((destinationPrice - originPrice) * 100) / 100;
}

/**
 * Compute seat availability counts for a bus on a given schedule and trip date.
 * Return total enabled seats and available (non-booked) seats count.
 */
export function computeAvailability(
  totalEnabledSeats: number,
  bookedSeatCount: number,
): { availableSeats: number; totalSeats: number } {
  return {
    availableSeats: totalEnabledSeats - bookedSeatCount,
    totalSeats: totalEnabledSeats,
  };
}

/**
 * Service handling public search and trip detail queries.
 * Provides trip search by origin/destination/date and detailed seat availability maps.
 */
export class SearchService {
  /** Create a search service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Search for available trips matching origin and destination stops on a given date.
   * Find schedules with stop times matching the origin and destination (in correct order),
   * compute segment pricing, and return available seat counts. Include active delays.
   */
  async searchTrips(query: SearchTripsQuery): Promise<PaginatedSearchResults> {
    const { origin, destination, date, page, pageSize } = query;
    const { skip, take } = parsePagination(page, pageSize);

    const tripDate = new Date(date);

    // Find schedules that have stop times matching both origin and destination
    // Origin stop must come before destination stop (by orderIndex)
    const schedules = await this.prisma.schedule.findMany({
      where: {
        status: 'ACTIVE',
        stopTimes: {
          some: {
            stopName: { contains: origin, mode: 'insensitive' },
          },
        },
      },
      include: {
        stopTimes: { orderBy: { orderIndex: 'asc' } },
        route: { include: { provider: { select: { name: true } } } },
        bus: { include: { seats: { select: { id: true, isEnabled: true, type: true } } } },
        bookingSeats: {
          where: { tripDate },
          select: { seatLabel: true },
        },
        delays: {
          where: { tripDate, active: true },
          select: { id: true, offsetMinutes: true, reason: true },
        },
      },
    });

    // Filter and build results: both stops must exist and be in correct order
    const results: SearchResult[] = [];

    for (const schedule of schedules) {
      const originStop = schedule.stopTimes.find((st) =>
        st.stopName.toLowerCase().includes(origin.toLowerCase()),
      );
      const destStop = schedule.stopTimes.find((st) =>
        st.stopName.toLowerCase().includes(destination.toLowerCase()),
      );

      if (!originStop || !destStop) continue;
      if (originStop.orderIndex >= destStop.orderIndex) continue;

      const enabledSeats = schedule.bus.seats.filter((s) => s.isEnabled && s.type !== 'BLOCKED');
      const bookedCount = schedule.bookingSeats.length;
      const { availableSeats, totalSeats } = computeAvailability(enabledSeats.length, bookedCount);
      const price = computeSegmentPrice(originStop.priceFromStart, destStop.priceFromStart);

      results.push({
        scheduleId: schedule.id,
        providerName: schedule.route.provider.name,
        routeName: schedule.route.name,
        origin: originStop.stopName,
        destination: destStop.stopName,
        departureTime: originStop.departureTime,
        arrivalTime: destStop.arrivalTime,
        tripDate,
        price,
        availableSeats,
        totalSeats,
      });
    }

    // Apply pagination to in-memory results
    const total = results.length;
    const paginatedResults = results.slice(skip, skip + take);

    logger.debug('Trip search completed', { origin, destination, date, totalResults: total });

    return {
      data: paginatedResults,
      meta: buildPaginationMeta({ total, page, pageSize }),
    };
  }

  /**
   * Retrieve detailed trip information for a schedule on a specific date.
   * Return the full schedule with seat availability map showing which seats are booked.
   * Throw RESOURCE_NOT_FOUND if the schedule does not exist.
   */
  async getTripDetails(scheduleId: string, tripDate: string): Promise<TripDetail> {
    const tripDateObj = new Date(tripDate);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        stopTimes: { orderBy: { orderIndex: 'asc' } },
        route: { include: { provider: { select: { name: true } } } },
        bus: { include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } } },
        bookingSeats: {
          where: { tripDate: tripDateObj },
          select: { seatLabel: true },
        },
      },
    });

    if (!schedule) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
    }

    const bookedLabels = new Set(schedule.bookingSeats.map((bs) => bs.seatLabel));

    const seats: SeatAvailability[] = schedule.bus.seats.map((seat) => ({
      id: seat.id,
      row: seat.row,
      column: seat.column,
      label: seat.label,
      type: seat.type,
      price: seat.price,
      isEnabled: seat.isEnabled,
      isBooked: bookedLabels.has(seat.label),
    }));

    const stopTimes: TripStopTime[] = schedule.stopTimes.map((st) => ({
      id: st.id,
      stopName: st.stopName,
      arrivalTime: st.arrivalTime,
      departureTime: st.departureTime,
      orderIndex: st.orderIndex,
      priceFromStart: st.priceFromStart,
    }));

    logger.debug('Trip details retrieved', { scheduleId, tripDate });

    return {
      scheduleId: schedule.id,
      routeName: schedule.route.name,
      providerName: schedule.route.provider.name,
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      tripDate: tripDateObj,
      basePrice: schedule.basePrice,
      status: schedule.status,
      stopTimes,
      seats,
    };
  }
}
