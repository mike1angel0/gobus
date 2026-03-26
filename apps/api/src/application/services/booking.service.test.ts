import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService, validateSeatsOnBus, validateStopOrder } from './booking.service.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import type { BookingStatus } from '@/generated/prisma/client.js';

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Re-export computeSegmentPrice for use in transaction mock
vi.mock('./search.service.js', () => ({
  computeSegmentPrice: (origin: number, dest: number) => Math.round((dest - origin) * 100) / 100,
}));

const USER_ID = 'user-1';
const SCHEDULE_ID = 'schedule-1';
const TRIP_DATE = '2026-03-25';
const TRIP_DATE_OBJ = new Date('2026-03-25');

function makeBusSeats() {
  return [
    { label: '1A', isEnabled: true, type: 'STANDARD' },
    { label: '1B', isEnabled: true, type: 'STANDARD' },
    { label: '2A', isEnabled: false, type: 'STANDARD' },
    { label: '2B', isEnabled: true, type: 'BLOCKED' },
  ];
}

function makeStopTimes() {
  return [
    { stopName: 'Bucharest', orderIndex: 0, priceFromStart: 0 },
    { stopName: 'Pitesti', orderIndex: 1, priceFromStart: 30 },
    { stopName: 'Cluj-Napoca', orderIndex: 2, priceFromStart: 100 },
  ];
}

function makeScheduleWithRelations() {
  return {
    id: SCHEDULE_ID,
    stopTimes: makeStopTimes(),
    bus: { seats: makeBusSeats() },
  };
}

function makeBookingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    orderId: 'order-1',
    userId: USER_ID,
    scheduleId: SCHEDULE_ID,
    totalPrice: 200,
    status: 'CONFIRMED' as BookingStatus,
    boardingStop: 'Bucharest',
    alightingStop: 'Cluj-Napoca',
    tripDate: TRIP_DATE_OBJ,
    createdAt: new Date('2026-03-25T10:00:00Z'),
    bookingSeats: [{ seatLabel: '1A' }, { seatLabel: '1B' }],
    schedule: {
      departureTime: new Date('2026-03-25T08:00:00Z'),
      arrivalTime: new Date('2026-03-25T14:00:00Z'),
      route: {
        id: 'route-1',
        name: 'Bucharest - Cluj',
        provider: { id: 'provider-1', name: 'TransAlpin' },
      },
      bus: { id: 'bus-1', licensePlate: 'B-123-ABC', model: 'Mercedes Tourismo' },
    },
    ...overrides,
  };
}

function createMockPrisma() {
  const txClient = {
    schedule: { findUnique: vi.fn() },
    bookingSeat: { findMany: vi.fn() },
    booking: { create: vi.fn() },
  };

  return {
    $transaction: vi.fn(async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient)),
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    _tx: txClient,
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('validateSeatsOnBus', () => {
  const seats = makeBusSeats();

  it('should pass for valid enabled seats', () => {
    expect(() => validateSeatsOnBus(['1A', '1B'], seats)).not.toThrow();
  });

  it('should throw for non-existent seat label', () => {
    try {
      validateSeatsOnBus(['3A'], seats);
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(e.detail).toBe('Seat 3A does not exist on this bus');
    }
  });

  it('should throw for disabled seat', () => {
    try {
      validateSeatsOnBus(['2A'], seats);
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.detail).toBe('Seat 2A is not enabled');
    }
  });

  it('should throw for blocked seat', () => {
    try {
      validateSeatsOnBus(['2B'], seats);
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.detail).toBe('Seat 2B is blocked and cannot be booked');
    }
  });
});

describe('validateStopOrder', () => {
  const stops = makeStopTimes();

  it('should return stop times for valid boarding before alighting', () => {
    const result = validateStopOrder('Bucharest', 'Cluj-Napoca', stops);
    expect(result.boardingStopTime.priceFromStart).toBe(0);
    expect(result.alightingStopTime.priceFromStart).toBe(100);
  });

  it('should throw when boarding stop not found', () => {
    try {
      validateStopOrder('Nonexistent', 'Cluj-Napoca', stops);
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(e.detail).toBe('Boarding stop "Nonexistent" not found in schedule');
    }
  });

  it('should throw when alighting stop not found', () => {
    try {
      validateStopOrder('Bucharest', 'Nonexistent', stops);
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.detail).toBe('Alighting stop "Nonexistent" not found in schedule');
    }
  });

  it('should throw when boarding comes after alighting', () => {
    try {
      validateStopOrder('Cluj-Napoca', 'Bucharest', stops);
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.detail).toBe('Boarding stop must come before alighting stop in route order');
    }
  });

  it('should throw when boarding equals alighting', () => {
    try {
      validateStopOrder('Bucharest', 'Bucharest', stops);
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.detail).toBe('Boarding stop must come before alighting stop in route order');
    }
  });
});

describe('BookingService', () => {
  let prisma: MockPrisma;
  let service: BookingService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new BookingService(
      prisma as unknown as Parameters<
        typeof BookingService extends new (p: infer P) => unknown ? (p: P) => void : never
      >[0],
    );
  });

  describe('create', () => {
    it('should create a booking with correct total price', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(0);
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma._tx.schedule.findUnique).mockResolvedValue(schedule);
      vi.mocked(prisma._tx.bookingSeat.findMany).mockResolvedValue([]);

      const createdBooking = makeBookingRecord();
      vi.mocked(prisma._tx.booking.create).mockResolvedValue(createdBooking);

      const result = await service.create(USER_ID, {
        scheduleId: SCHEDULE_ID,
        seatLabels: ['1A', '1B'],
        boardingStop: 'Bucharest',
        alightingStop: 'Cluj-Napoca',
        tripDate: TRIP_DATE,
      });

      expect(result.id).toBe('booking-1');
      expect(result.orderId).toBe('order-1');
      expect(result.userId).toBe(USER_ID);
      expect(result.scheduleId).toBe(SCHEDULE_ID);
      expect(result.seatLabels).toEqual(['1A', '1B']);
      expect(result.boardingStop).toBe('Bucharest');
      expect(result.alightingStop).toBe('Cluj-Napoca');
      expect(result.status).toBe('CONFIRMED');
      expect(result.schedule.route.name).toBe('Bucharest - Cluj');
      expect(result.schedule.bus.licensePlate).toBe('B-123-ABC');

      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalledOnce();

      // Verify booking was created with correct total price (100 * 2 seats = 200)
      const createCall = vi.mocked(prisma._tx.booking.create).mock.calls[0][0];
      expect(createCall.data.totalPrice).toBe(200);
      expect(createCall.data.boardingStop).toBe('Bucharest');
      expect(createCall.data.alightingStop).toBe('Cluj-Napoca');
    });

    it('should throw 429 when user has 5 active bookings', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(5);

      try {
        await service.create(USER_ID, {
          scheduleId: SCHEDULE_ID,
          seatLabels: ['1A'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj-Napoca',
          tripDate: TRIP_DATE,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(429);
        expect(e.code).toBe(ErrorCodes.RESOURCE_EXHAUSTED);
        expect(e.detail).toBe('Maximum 5 active bookings allowed per user');
      }
    });

    it('should allow booking when user has 4 active bookings', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(4);
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma._tx.schedule.findUnique).mockResolvedValue(schedule);
      vi.mocked(prisma._tx.bookingSeat.findMany).mockResolvedValue([]);
      vi.mocked(prisma._tx.booking.create).mockResolvedValue(makeBookingRecord());

      const result = await service.create(USER_ID, {
        scheduleId: SCHEDULE_ID,
        seatLabels: ['1A'],
        boardingStop: 'Bucharest',
        alightingStop: 'Cluj-Napoca',
        tripDate: TRIP_DATE,
      });

      expect(result.id).toBe('booking-1');
    });

    it('should throw 404 when schedule not found', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(0);
      vi.mocked(prisma._tx.schedule.findUnique).mockResolvedValue(null);

      await expect(
        service.create(USER_ID, {
          scheduleId: 'nonexistent',
          seatLabels: ['1A'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj-Napoca',
          tripDate: TRIP_DATE,
        }),
      ).rejects.toThrow(AppError);

      try {
        await service.create(USER_ID, {
          scheduleId: 'nonexistent',
          seatLabels: ['1A'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj-Napoca',
          tripDate: TRIP_DATE,
        });
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(404);
        expect(e.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      }
    });

    it('should throw 409 SEAT_CONFLICT when seats are already booked', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(0);
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma._tx.schedule.findUnique).mockResolvedValue(schedule);
      vi.mocked(prisma._tx.bookingSeat.findMany).mockResolvedValue([{ seatLabel: '1A' }]);

      try {
        await service.create(USER_ID, {
          scheduleId: SCHEDULE_ID,
          seatLabels: ['1A', '1B'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj-Napoca',
          tripDate: TRIP_DATE,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(409);
        expect(e.code).toBe(ErrorCodes.SEAT_CONFLICT);
        expect(e.detail).toBe('Seats already booked: 1A');
      }
    });

    it('should throw 400 for invalid seat label', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(0);
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma._tx.schedule.findUnique).mockResolvedValue(schedule);

      try {
        await service.create(USER_ID, {
          scheduleId: SCHEDULE_ID,
          seatLabels: ['9Z'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj-Napoca',
          tripDate: TRIP_DATE,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(400);
        expect(e.code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    });

    it('should throw 400 for invalid stop order', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(0);
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma._tx.schedule.findUnique).mockResolvedValue(schedule);

      try {
        await service.create(USER_ID, {
          scheduleId: SCHEDULE_ID,
          seatLabels: ['1A'],
          boardingStop: 'Cluj-Napoca',
          alightingStop: 'Bucharest',
          tripDate: TRIP_DATE,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(400);
      }
    });

    it('should compute correct price for intermediate segment', async () => {
      vi.mocked(prisma.booking.count).mockResolvedValue(0);
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma._tx.schedule.findUnique).mockResolvedValue(schedule);
      vi.mocked(prisma._tx.bookingSeat.findMany).mockResolvedValue([]);
      vi.mocked(prisma._tx.booking.create).mockResolvedValue(makeBookingRecord({ totalPrice: 30 }));

      await service.create(USER_ID, {
        scheduleId: SCHEDULE_ID,
        seatLabels: ['1A'],
        boardingStop: 'Bucharest',
        alightingStop: 'Pitesti',
        tripDate: TRIP_DATE,
      });

      const createCall = vi.mocked(prisma._tx.booking.create).mock.calls[0][0];
      // Segment: 30 - 0 = 30, 1 seat = 30
      expect(createCall.data.totalPrice).toBe(30);
    });
  });

  describe('listByUser', () => {
    it('should return paginated bookings for user', async () => {
      const bookings = [makeBookingRecord()];
      vi.mocked(prisma.booking.findMany).mockResolvedValue(bookings);
      vi.mocked(prisma.booking.count).mockResolvedValue(1);

      const result = await service.listByUser(USER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('booking-1');
      expect(result.data[0].seatLabels).toEqual(['1A', '1B']);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by status when provided', async () => {
      vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
      vi.mocked(prisma.booking.count).mockResolvedValue(0);

      await service.listByUser(USER_ID, {
        page: 1,
        pageSize: 20,
        status: 'CANCELLED' as BookingStatus,
      });

      const findManyCall = vi.mocked(prisma.booking.findMany).mock.calls[0][0];
      expect(findManyCall?.where).toEqual({ userId: USER_ID, status: 'CANCELLED' });
    });

    it('should return empty list when no bookings', async () => {
      vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
      vi.mocked(prisma.booking.count).mockResolvedValue(0);

      const result = await service.listByUser(USER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('getById', () => {
    it('should return booking when owned by user', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(makeBookingRecord());

      const result = await service.getById('booking-1', USER_ID);

      expect(result.id).toBe('booking-1');
      expect(result.schedule.route.provider.name).toBe('TransAlpin');
    });

    it('should throw 404 when booking not found', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

      try {
        await service.getById('nonexistent', USER_ID);
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(404);
        expect(e.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      }
    });

    it('should throw 404 when booking owned by different user', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(
        makeBookingRecord({ userId: 'other-user' }),
      );

      try {
        await service.getById('booking-1', USER_ID);
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(404);
        expect(e.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      }
    });
  });

  describe('cancel', () => {
    it('should cancel a confirmed booking', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(makeBookingRecord());
      vi.mocked(prisma.booking.update).mockResolvedValue(
        makeBookingRecord({ status: 'CANCELLED' as BookingStatus }),
      );

      const result = await service.cancel('booking-1', USER_ID);

      expect(result.status).toBe('CANCELLED');
      expect(vi.mocked(prisma.booking.update)).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: 'CANCELLED' },
        include: expect.objectContaining({ bookingSeats: expect.any(Object) }),
      });
    });

    it('should throw 404 when booking not found for cancellation', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

      try {
        await service.cancel('nonexistent', USER_ID);
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(404);
        expect(e.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      }
    });

    it('should throw 404 when cancelling booking owned by different user', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(
        makeBookingRecord({ userId: 'other-user' }),
      );

      try {
        await service.cancel('booking-1', USER_ID);
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(404);
      }
    });

    it('should throw 400 when cancelling already cancelled booking', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(
        makeBookingRecord({ status: 'CANCELLED' as BookingStatus }),
      );

      try {
        await service.cancel('booking-1', USER_ID);
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(400);
        expect(e.code).toBe(ErrorCodes.VALIDATION_ERROR);
        expect(e.detail).toBe('Booking cannot be cancelled — current status is CANCELLED');
      }
    });

    it('should throw 400 when cancelling completed booking', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue(
        makeBookingRecord({ status: 'COMPLETED' as BookingStatus }),
      );

      try {
        await service.cancel('booking-1', USER_ID);
        expect.fail('Should have thrown');
      } catch (err) {
        const e = err as AppError;
        expect(e.statusCode).toBe(400);
        expect(e.detail).toBe('Booking cannot be cancelled — current status is COMPLETED');
      }
    });
  });
});
