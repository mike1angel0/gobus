import type { PrismaClient, ScheduleStatus } from '@/generated/prisma/client.js';
import type {
  DriverTrip,
  DriverTripDetail,
  DriverTripPassenger,
  DriverTripStopTime,
} from '@/domain/driver-trips/driver-trip.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('DriverTripService');

/**
 * Derive the day-of-week index (0=Sunday, 6=Saturday) for a given date string.
 * Return the JS Date getDay() value for the parsed date.
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getUTCDay();
}

/**
 * Convert a date string (YYYY-MM-DD) to a Date object at midnight UTC.
 * Default to today (UTC) if no date is provided.
 */
export function resolveTripDate(date?: string): { dateStr: string; dateObj: Date } {
  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  const dateObj = new Date(dateStr);
  return { dateStr, dateObj };
}

/** Prisma schedule record shape returned from list query. */
interface ScheduleListRecord {
  id: string;
  departureTime: Date;
  arrivalTime: Date;
  daysOfWeek: number[];
  status: ScheduleStatus;
  tripDate: Date;
  route: { name: string };
  bus: { licensePlate: string };
}

/** Map a schedule list record to a DriverTrip entity. */
function toDriverTrip(record: ScheduleListRecord, tripDate: Date): DriverTrip {
  return {
    scheduleId: record.id,
    departureTime: record.departureTime,
    arrivalTime: record.arrivalTime,
    tripDate,
    routeName: record.route.name,
    busLicensePlate: record.bus.licensePlate,
    status: record.status,
  };
}

/** Prisma stop time record shape. */
interface StopTimeRecord {
  id: string;
  stopName: string;
  arrivalTime: Date;
  departureTime: Date;
  orderIndex: number;
  priceFromStart: number;
  lat: number | null;
  lng: number | null;
}

/** Map a Prisma stop time record to a DriverTripStopTime entity. */
function toStopTime(record: StopTimeRecord): DriverTripStopTime {
  return {
    id: record.id,
    stopName: record.stopName,
    arrivalTime: record.arrivalTime,
    departureTime: record.departureTime,
    orderIndex: record.orderIndex,
    priceFromStart: record.priceFromStart,
    lat: record.lat,
    lng: record.lng,
  };
}

/** Paginated driver trip results. */
export interface PaginatedDriverTrips {
  /** List of driver trips for the current page. */
  data: DriverTrip[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Service handling driver trip listing and detail queries.
 * Provide trip lists filtered by date and detailed trip views with passenger counts.
 */
export class DriverTripService {
  /** Create a driver trip service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List trips assigned to a driver for a given date with pagination.
   * Filter schedules where driverId matches and the tripDate matches the requested date
   * or the daysOfWeek pattern includes the requested day.
   */
  async listTrips(
    driverId: string,
    date?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedDriverTrips> {
    const { dateStr, dateObj } = resolveTripDate(date);
    const dayOfWeek = getDayOfWeek(dateStr);
    const { skip, take } = parsePagination(page, pageSize);

    const where = {
      driverId,
      status: 'ACTIVE' as const,
      OR: [{ tripDate: dateObj }, { daysOfWeek: { has: dayOfWeek } }],
    };

    const [schedules, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: {
          route: { select: { name: true } },
          bus: { select: { licensePlate: true } },
        },
        orderBy: { departureTime: 'asc' },
        skip,
        take,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    logger.debug('Driver trips listed', {
      driverId,
      date: dateStr,
      count: schedules.length,
      total,
    });

    return {
      data: schedules.map((s) => toDriverTrip(s, dateObj)),
      meta: buildPaginationMeta({ total, page, pageSize }),
    };
  }

  /**
   * Retrieve detailed trip information for a driver on a specific schedule.
   * Validate that the driver is assigned to this schedule.
   * Include stop times, passenger count (confirmed bookings), and total bus capacity.
   */
  async getTripDetail(
    driverId: string,
    scheduleId: string,
    date?: string,
  ): Promise<DriverTripDetail> {
    const { dateStr, dateObj } = resolveTripDate(date);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        route: { select: { name: true } },
        bus: { select: { id: true, licensePlate: true, model: true, capacity: true } },
        stopTimes: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!schedule) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
    }

    // Validate driver assignment
    if (schedule.driverId !== driverId) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
    }

    // Count confirmed bookings for this schedule and trip date
    const passengerCount = await this.prisma.booking.count({
      where: {
        scheduleId,
        tripDate: dateObj,
        status: 'CONFIRMED',
      },
    });

    logger.debug('Driver trip detail retrieved', {
      driverId,
      scheduleId,
      date: dateStr,
      passengerCount,
    });

    return {
      scheduleId: schedule.id,
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      tripDate: dateObj,
      routeName: schedule.route.name,
      busId: schedule.bus.id,
      busLicensePlate: schedule.bus.licensePlate,
      busModel: schedule.bus.model,
      status: schedule.status,
      stops: schedule.stopTimes.map(toStopTime),
      passengerCount,
      totalSeats: schedule.bus.capacity,
    };
  }

  /**
   * Retrieve the passenger list for a driver's trip.
   * Validate that the driver is assigned to the schedule.
   * Return confirmed bookings with passenger names and seat labels.
   */
  async getPassengers(
    driverId: string,
    scheduleId: string,
    date?: string,
  ): Promise<DriverTripPassenger[]> {
    const { dateStr, dateObj } = resolveTripDate(date);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { driverId: true },
    });

    if (!schedule) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
    }

    if (schedule.driverId !== driverId) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        scheduleId,
        tripDate: dateObj,
        status: 'CONFIRMED',
      },
      include: {
        user: { select: { name: true } },
        bookingSeats: { select: { seatLabel: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    logger.debug('Driver trip passengers retrieved', {
      driverId,
      scheduleId,
      date: dateStr,
      count: bookings.length,
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      passengerName: b.user.name,
      boardingStop: b.boardingStop,
      alightingStop: b.alightingStop,
      seatLabels: b.bookingSeats.map((bs) => bs.seatLabel),
      status: b.status,
    }));
  }
}
