import type { PrismaClient, ScheduleStatus } from '@/generated/prisma/client.js';
import type {
  DriverTrip,
  DriverTripDetail,
  DriverTripStopTime,
} from '@/domain/driver-trips/driver-trip.entity.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
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
  };
}

/**
 * Service handling driver trip listing and detail queries.
 * Provide trip lists filtered by date and detailed trip views with passenger counts.
 */
export class DriverTripService {
  /** Create a driver trip service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List trips assigned to a driver for a given date.
   * Filter schedules where driverId matches and the tripDate matches the requested date
   * or the daysOfWeek pattern includes the requested day.
   */
  async listTrips(driverId: string, date?: string): Promise<DriverTrip[]> {
    const { dateStr, dateObj } = resolveTripDate(date);
    const dayOfWeek = getDayOfWeek(dateStr);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        driverId,
        status: 'ACTIVE',
        OR: [
          { tripDate: dateObj },
          { daysOfWeek: { has: dayOfWeek } },
        ],
      },
      include: {
        route: { select: { name: true } },
        bus: { select: { licensePlate: true } },
      },
      orderBy: { departureTime: 'asc' },
    });

    logger.debug('Driver trips listed', { driverId, date: dateStr, count: schedules.length });

    return schedules.map((s) => toDriverTrip(s, dateObj));
  }

  /**
   * Retrieve detailed trip information for a driver on a specific schedule.
   * Validate that the driver is assigned to this schedule.
   * Include stop times, passenger count (confirmed bookings), and total bus capacity.
   */
  async getTripDetail(driverId: string, scheduleId: string, date?: string): Promise<DriverTripDetail> {
    const { dateStr, dateObj } = resolveTripDate(date);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        route: { select: { name: true } },
        bus: { select: { licensePlate: true, model: true, capacity: true } },
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
      busLicensePlate: schedule.bus.licensePlate,
      busModel: schedule.bus.model,
      status: schedule.status,
      stops: schedule.stopTimes.map(toStopTime),
      passengerCount,
      totalSeats: schedule.bus.capacity,
    };
  }
}
