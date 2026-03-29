import type { PrismaClient, BookingStatus } from '@/generated/prisma/client.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { verifyOwnership } from '@/domain/errors/ownership.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';
import { computeSegmentPrice } from './search.service.js';

const logger = createLogger('BookingService');

/** Maximum number of active (CONFIRMED) bookings a single user can hold. */
const MAX_ACTIVE_BOOKINGS_PER_USER = 5;

/** Input for creating a new booking. */
export interface CreateBookingInput {
  /** Schedule to book seats on. */
  scheduleId: string;
  /** Seat labels to reserve (e.g. ["1A", "1B"]). */
  seatLabels: string[];
  /** Name of the boarding stop (must exist in schedule stop times). */
  boardingStop: string;
  /** Name of the alighting stop (must come after boarding in route order). */
  alightingStop: string;
  /** Date of the trip (ISO 8601 date string). */
  tripDate: string;
}

/** Query parameters for listing a user's bookings. */
export interface ListBookingsQuery {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Optional booking status filter. */
  status?: BookingStatus;
}

/** Booking with related schedule, route, provider, and bus details. */
export interface BookingWithDetails {
  /** Unique booking identifier. */
  id: string;
  /** Human-friendly unique order identifier. */
  orderId: string;
  /** User who made the booking. */
  userId: string;
  /** Booked schedule ID. */
  scheduleId: string;
  /** Total price for all booked seats. */
  totalPrice: number;
  /** Booking status. */
  status: BookingStatus;
  /** Name of the boarding stop. */
  boardingStop: string;
  /** Name of the alighting stop. */
  alightingStop: string;
  /** Date of the trip. */
  tripDate: Date;
  /** Labels of booked seats. */
  seatLabels: string[];
  /** Booking creation timestamp. */
  createdAt: Date;
  /** Expanded schedule with route and provider info. */
  schedule: {
    departureTime: Date;
    arrivalTime: Date;
    route: {
      id: string;
      name: string;
      provider: { id: string; name: string };
    };
    bus: {
      id: string;
      licensePlate: string;
      model: string;
    };
  };
}

/** Result of listing bookings with pagination metadata. */
export interface PaginatedBookings {
  /** List of bookings for the current page. */
  data: BookingWithDetails[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Validate that requested seats exist on the bus, are enabled, and are not BLOCKED.
 * Return the set of valid seat labels. Throw VALIDATION_ERROR on failure.
 */
export function validateSeatsOnBus(
  requestedLabels: string[],
  busSeats: Array<{ label: string; isEnabled: boolean; type: string }>,
): void {
  const seatMap = new Map(busSeats.map((s) => [s.label, s]));

  for (const label of requestedLabels) {
    const seat = seatMap.get(label);
    if (!seat) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Seat ${label} does not exist on this bus`,
      );
    }
    if (!seat.isEnabled) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Seat ${label} is not enabled`);
    }
    if (seat.type === 'BLOCKED') {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Seat ${label} is blocked and cannot be booked`,
      );
    }
  }
}

/**
 * Validate that boarding and alighting stops exist in the schedule and boarding comes before alighting.
 * Return the stop time records for price computation. Throw VALIDATION_ERROR on failure.
 */
export function validateStopOrder(
  boardingStop: string,
  alightingStop: string,
  stopTimes: Array<{ stopName: string; orderIndex: number; priceFromStart: number }>,
): { boardingStopTime: { priceFromStart: number }; alightingStopTime: { priceFromStart: number } } {
  const boarding = stopTimes.find((st) => st.stopName === boardingStop);
  if (!boarding) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      `Boarding stop "${boardingStop}" not found in schedule`,
    );
  }

  const alighting = stopTimes.find((st) => st.stopName === alightingStop);
  if (!alighting) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      `Alighting stop "${alightingStop}" not found in schedule`,
    );
  }

  if (boarding.orderIndex >= alighting.orderIndex) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Boarding stop must come before alighting stop in route order',
    );
  }

  return { boardingStopTime: boarding, alightingStopTime: alighting };
}

/** Prisma include clause for fetching booking with details. */
const BOOKING_WITH_DETAILS_INCLUDE = {
  bookingSeats: { select: { seatLabel: true } },
  schedule: {
    include: {
      route: {
        include: {
          provider: { select: { id: true, name: true } },
        },
      },
      bus: { select: { id: true, licensePlate: true, model: true } },
    },
  },
} as const;

/**
 * Map a Prisma booking record with included relations to a BookingWithDetails shape.
 * Extract seatLabels from bookingSeats relation.
 */
function toBookingWithDetails(booking: {
  id: string;
  orderId: string;
  userId: string;
  scheduleId: string;
  totalPrice: number;
  status: BookingStatus;
  boardingStop: string;
  alightingStop: string;
  tripDate: Date;
  createdAt: Date;
  bookingSeats: Array<{ seatLabel: string }>;
  schedule: {
    departureTime: Date;
    arrivalTime: Date;
    route: {
      id: string;
      name: string;
      provider: { id: string; name: string };
    };
    bus: { id: string; licensePlate: string; model: string };
  };
}): BookingWithDetails {
  return {
    id: booking.id,
    orderId: booking.orderId,
    userId: booking.userId,
    scheduleId: booking.scheduleId,
    totalPrice: booking.totalPrice,
    status: booking.status,
    boardingStop: booking.boardingStop,
    alightingStop: booking.alightingStop,
    tripDate: booking.tripDate,
    seatLabels: booking.bookingSeats.map((bs) => bs.seatLabel),
    createdAt: booking.createdAt,
    schedule: {
      departureTime: booking.schedule.departureTime,
      arrivalTime: booking.schedule.arrivalTime,
      route: {
        id: booking.schedule.route.id,
        name: booking.schedule.route.name,
        provider: {
          id: booking.schedule.route.provider.id,
          name: booking.schedule.route.provider.name,
        },
      },
      bus: {
        id: booking.schedule.bus.id,
        licensePlate: booking.schedule.bus.licensePlate,
        model: booking.schedule.bus.model,
      },
    },
  };
}

/**
 * Service handling booking creation, retrieval, listing, and cancellation.
 * Enforce ownership for all operations — users can only access their own bookings.
 * Use Prisma transactions with serializable isolation to prevent double-booking.
 */
export class BookingService {
  /** Create a booking service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new booking atomically using a serializable transaction.
   * Validate schedule existence, seat availability, stop order, and compute total price.
   * Throw SEAT_CONFLICT (409) if any requested seat is already booked for the trip date.
   */
  async create(userId: string, input: CreateBookingInput): Promise<BookingWithDetails> {
    const { scheduleId, seatLabels, boardingStop, alightingStop, tripDate } = input;
    const tripDateObj = new Date(tripDate);

    // Enforce max 5 active bookings per user (DoS prevention)
    const activeCount = await this.prisma.booking.count({
      where: { userId, status: 'CONFIRMED' },
    });
    if (activeCount >= MAX_ACTIVE_BOOKINGS_PER_USER) {
      throw new AppError(
        429,
        ErrorCodes.RESOURCE_EXHAUSTED,
        `Maximum ${MAX_ACTIVE_BOOKINGS_PER_USER} active bookings allowed per user`,
      );
    }

    const booking = await this.prisma.$transaction(
      async (tx) => {
        // 1. Fetch schedule with stops and bus seats
        const schedule = await tx.schedule.findUnique({
          where: { id: scheduleId },
          include: {
            stopTimes: { orderBy: { orderIndex: 'asc' } },
            bus: { include: { seats: { select: { label: true, isEnabled: true, type: true } } } },
          },
        });

        if (!schedule) {
          throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Schedule not found');
        }

        // 2. Validate seats exist, are enabled, and not blocked
        validateSeatsOnBus(seatLabels, schedule.bus.seats);

        // 3. Validate stop order
        const { boardingStopTime, alightingStopTime } = validateStopOrder(
          boardingStop,
          alightingStop,
          schedule.stopTimes,
        );

        // 4. Check for existing bookings on requested seats (race condition prevention)
        const existingBookedSeats = await tx.bookingSeat.findMany({
          where: {
            scheduleId,
            tripDate: tripDateObj,
            seatLabel: { in: seatLabels },
          },
          select: { seatLabel: true },
        });

        if (existingBookedSeats.length > 0) {
          const conflicting = existingBookedSeats.map((s) => s.seatLabel).join(', ');
          throw new AppError(409, ErrorCodes.SEAT_CONFLICT, `Seats already booked: ${conflicting}`);
        }

        // 5. Compute total price: segment price * number of seats
        const segmentPrice = computeSegmentPrice(
          boardingStopTime.priceFromStart,
          alightingStopTime.priceFromStart,
        );
        const totalPrice = Math.round(segmentPrice * seatLabels.length * 100) / 100;

        // 6. Generate human-friendly orderId: GB{CODE}-{YYYYMMDD}-{NNN}
        const route = await tx.route.findUnique({
          where: { id: schedule.routeId },
          select: { provider: { select: { id: true, code: true } } },
        });
        if (!route) {
          throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Route not found');
        }
        const providerCode = route.provider.code;

        const dayStart = new Date(tripDateObj);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(tripDateObj);
        dayEnd.setUTCHours(23, 59, 59, 999);

        const todayCount = await tx.booking.count({
          where: {
            schedule: { route: { providerId: route.provider.id } },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        });

        const seq = String(todayCount + 1).padStart(3, '0');
        const dateStr = tripDateObj.toISOString().slice(0, 10).replace(/-/g, '');
        const orderId = `GB${providerCode}-${dateStr}-${seq}`;

        // 7. Create booking + booking seats atomically
        const created = await tx.booking.create({
          data: {
            orderId,
            userId,
            scheduleId,
            totalPrice,
            boardingStop,
            alightingStop,
            tripDate: tripDateObj,
            bookingSeats: {
              create: seatLabels.map((label) => ({
                seatLabel: label,
                scheduleId,
                tripDate: tripDateObj,
              })),
            },
          },
          include: BOOKING_WITH_DETAILS_INCLUDE,
        });

        return created;
      },
      { isolationLevel: 'Serializable' },
    );

    logger.info('Booking created', { bookingId: booking.id, userId, scheduleId, seatLabels });

    return toBookingWithDetails(booking);
  }

  /**
   * List bookings for a user with pagination and optional status filter.
   * Return bookings sorted by creation date descending.
   */
  async listByUser(userId: string, query: ListBookingsQuery): Promise<PaginatedBookings> {
    const { page, pageSize, status } = query;
    const { skip, take } = parsePagination(page, pageSize);

    const where = {
      userId,
      ...(status ? { status } : {}),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_WITH_DETAILS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.booking.count({ where }),
    ]);

    logger.debug('Listed bookings', { userId, page, pageSize, total });

    return {
      data: bookings.map(toBookingWithDetails),
      meta: buildPaginationMeta({ total, page, pageSize }),
    };
  }

  /**
   * Retrieve a booking by ID with ownership enforcement.
   * Return 404 (not 403) if the booking belongs to another user to prevent enumeration.
   */
  async getById(id: string, userId: string): Promise<BookingWithDetails> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_WITH_DETAILS_INCLUDE,
    });

    verifyOwnership(booking, booking?.userId, userId, 'Booking');

    return toBookingWithDetails(booking);
  }

  /**
   * Cancel a confirmed booking with ownership enforcement.
   * Only CONFIRMED bookings can be cancelled. Return 404 for non-owned bookings.
   * Throw VALIDATION_ERROR if booking is already cancelled or completed.
   */
  async cancel(id: string, userId: string): Promise<BookingWithDetails> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });

    verifyOwnership(booking, booking?.userId, userId, 'Booking');

    if (booking.status !== 'CONFIRMED') {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Booking cannot be cancelled — current status is ${booking.status}`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: BOOKING_WITH_DETAILS_INCLUDE,
    });

    logger.info('Booking cancelled', { bookingId: id, userId });

    return toBookingWithDetails(updated);
  }
}
