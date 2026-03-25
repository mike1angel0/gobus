import type { PrismaClient } from '@/generated/prisma/client.js';
import type { BusTrackingData } from '@/domain/tracking/tracking.entity.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('TrackingService');

/** Input for updating a bus position. */
export interface UpdatePositionInput {
  /** Bus to update position for. */
  busId: string;
  /** Current latitude. */
  lat: number;
  /** Current longitude. */
  lng: number;
  /** Current speed in km/h. */
  speed: number;
  /** Current heading in degrees. */
  heading: number;
  /** Current stop index along the route. */
  currentStopIndex: number;
  /** Schedule ID (optional — inferred from driver assignment if omitted). */
  scheduleId?: string;
  /** Trip date (optional). */
  tripDate?: string;
}

/**
 * Map a Prisma BusTracking record to a BusTrackingData entity.
 * Extract only the fields needed for the API response.
 */
function toTrackingData(record: {
  id: string;
  busId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  scheduleId: string | null;
  currentStopIndex: number;
  isActive: boolean;
  tripDate: Date | null;
  updatedAt: Date;
}): BusTrackingData {
  return {
    id: record.id,
    busId: record.busId,
    lat: record.lat,
    lng: record.lng,
    speed: record.speed,
    heading: record.heading,
    scheduleId: record.scheduleId,
    currentStopIndex: record.currentStopIndex,
    isActive: record.isActive,
    tripDate: record.tripDate,
    updatedAt: record.updatedAt,
  };
}

/**
 * Service handling real-time bus tracking operations.
 * Provide position updates from drivers and tracking queries for consumers.
 */
export class TrackingService {
  /** Create a tracking service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Update the position of a bus driven by the authenticated driver.
   * Validate driver assignment to an active schedule for the bus.
   * Upsert the BusTracking record (create if new, update if exists).
   * Infer scheduleId from assignment if not provided.
   */
  async updatePosition(driverId: string, input: UpdatePositionInput): Promise<BusTrackingData> {
    const { busId, lat, lng, speed, heading, currentStopIndex, tripDate } = input;

    // Validate bus exists and driver is assigned in parallel
    const [bus, assignedSchedule] = await Promise.all([
      this.prisma.bus.findUnique({ where: { id: busId }, select: { id: true } }),
      this.prisma.schedule.findFirst({
        where: { busId, driverId, status: 'ACTIVE' },
        select: { id: true },
      }),
    ]);

    if (!bus) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Bus not found');
    }
    if (!assignedSchedule) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Not assigned to this bus');
    }

    // Infer scheduleId from assignment if not provided
    const resolvedScheduleId = input.scheduleId ?? assignedSchedule.id;

    const tripDateObj = tripDate ? new Date(tripDate) : null;

    const record = await this.prisma.busTracking.upsert({
      where: { busId },
      create: {
        busId,
        lat,
        lng,
        speed,
        heading,
        currentStopIndex,
        scheduleId: resolvedScheduleId,
        tripDate: tripDateObj,
        isActive: true,
      },
      update: {
        lat,
        lng,
        speed,
        heading,
        currentStopIndex,
        scheduleId: resolvedScheduleId,
        tripDate: tripDateObj,
        isActive: true,
      },
    });

    logger.info('Tracking updated', { busId, driverId, lat, lng });

    return toTrackingData(record);
  }

  /**
   * Retrieve current tracking data for a bus by its ID.
   * Return null if no tracking record exists (not an error).
   */
  async getByBusId(busId: string): Promise<BusTrackingData | null> {
    const record = await this.prisma.busTracking.findUnique({
      where: { busId },
    });

    if (!record) {
      return null;
    }

    logger.debug('Tracking retrieved', { busId });

    return toTrackingData(record);
  }

  /**
   * Retrieve all active tracking records for a provider's buses.
   * Return only records with isActive=true for buses belonging to the provider.
   */
  async getActiveByProvider(providerId: string): Promise<BusTrackingData[]> {
    const records = await this.prisma.busTracking.findMany({
      where: {
        isActive: true,
        bus: { providerId },
      },
    });

    logger.debug('Active tracking retrieved', { providerId, count: records.length });

    return records.map(toTrackingData);
  }
}
