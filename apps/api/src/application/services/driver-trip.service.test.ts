import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriverTripService, getDayOfWeek, resolveTripDate } from './driver-trip.service.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const DRIVER_ID = 'driver-1';
const SCHEDULE_ID = 'schedule-1';
const TRIP_DATE = '2026-03-25'; // Wednesday
const TRIP_DATE_OBJ = new Date('2026-03-25');

function makeScheduleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: SCHEDULE_ID,
    driverId: DRIVER_ID,
    departureTime: new Date('2026-03-25T08:00:00Z'),
    arrivalTime: new Date('2026-03-25T12:00:00Z'),
    daysOfWeek: [1, 3, 5],
    status: 'ACTIVE' as const,
    tripDate: TRIP_DATE_OBJ,
    route: { name: 'Bucharest - Cluj' },
    bus: { licensePlate: 'B-123-ABC', model: 'Mercedes Sprinter', capacity: 40 },
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: new Date('2026-03-25T08:00:00Z'),
        departureTime: new Date('2026-03-25T08:05:00Z'),
        orderIndex: 0,
        priceFromStart: 0,
      },
      {
        id: 'st-2',
        stopName: 'Pitesti',
        arrivalTime: new Date('2026-03-25T09:30:00Z'),
        departureTime: new Date('2026-03-25T09:35:00Z'),
        orderIndex: 1,
        priceFromStart: 25,
      },
      {
        id: 'st-3',
        stopName: 'Cluj',
        arrivalTime: new Date('2026-03-25T12:00:00Z'),
        departureTime: new Date('2026-03-25T12:00:00Z'),
        orderIndex: 2,
        priceFromStart: 60,
      },
    ],
    ...overrides,
  };
}

describe('DriverTripService', () => {
  let service: DriverTripService;
  let mockPrisma: {
    schedule: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    booking: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      schedule: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      booking: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new DriverTripService(mockPrisma as never);
  });

  describe('getDayOfWeek', () => {
    it('should return 3 for Wednesday 2026-03-25', () => {
      expect(getDayOfWeek('2026-03-25')).toBe(3);
    });

    it('should return 0 for Sunday 2026-03-22', () => {
      expect(getDayOfWeek('2026-03-22')).toBe(0);
    });

    it('should return 6 for Saturday 2026-03-28', () => {
      expect(getDayOfWeek('2026-03-28')).toBe(6);
    });
  });

  describe('resolveTripDate', () => {
    it('should parse provided date string', () => {
      const result = resolveTripDate('2026-03-25');
      expect(result.dateStr).toBe('2026-03-25');
      expect(result.dateObj).toEqual(new Date('2026-03-25'));
    });

    it('should default to today when no date provided', () => {
      const today = new Date().toISOString().slice(0, 10);
      const result = resolveTripDate();
      expect(result.dateStr).toBe(today);
    });
  });

  describe('listTrips', () => {
    it('should return paginated trips assigned to driver for matching date', async () => {
      const schedule = makeScheduleRecord();
      mockPrisma.schedule.findMany.mockResolvedValue([schedule]);
      mockPrisma.schedule.count.mockResolvedValue(1);

      const result = await service.listTrips(DRIVER_ID, TRIP_DATE, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        scheduleId: SCHEDULE_ID,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        tripDate: TRIP_DATE_OBJ,
        routeName: 'Bucharest - Cluj',
        busLicensePlate: 'B-123-ABC',
        status: 'ACTIVE',
      });
      expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
    });

    it('should query with correct where clause including daysOfWeek and tripDate', async () => {
      mockPrisma.schedule.findMany.mockResolvedValue([]);
      mockPrisma.schedule.count.mockResolvedValue(0);

      await service.listTrips(DRIVER_ID, TRIP_DATE, 1, 20);

      expect(mockPrisma.schedule.findMany).toHaveBeenCalledWith({
        where: {
          driverId: DRIVER_ID,
          status: 'ACTIVE',
          OR: [
            { tripDate: TRIP_DATE_OBJ },
            { daysOfWeek: { has: 3 } }, // Wednesday
          ],
        },
        include: {
          route: { select: { name: true } },
          bus: { select: { licensePlate: true } },
        },
        orderBy: { departureTime: 'asc' },
        skip: 0,
        take: 20,
      });
    });

    it('should return empty data with zero totalPages when no trips assigned', async () => {
      mockPrisma.schedule.findMany.mockResolvedValue([]);
      mockPrisma.schedule.count.mockResolvedValue(0);

      const result = await service.listTrips(DRIVER_ID, TRIP_DATE, 1, 20);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
    });

    it('should return multiple trips sorted by departure time', async () => {
      const schedule1 = makeScheduleRecord({
        id: 'sched-1',
        departureTime: new Date('2026-03-25T08:00:00Z'),
      });
      const schedule2 = makeScheduleRecord({
        id: 'sched-2',
        departureTime: new Date('2026-03-25T14:00:00Z'),
      });
      mockPrisma.schedule.findMany.mockResolvedValue([schedule1, schedule2]);
      mockPrisma.schedule.count.mockResolvedValue(2);

      const result = await service.listTrips(DRIVER_ID, TRIP_DATE, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].scheduleId).toBe('sched-1');
      expect(result.data[1].scheduleId).toBe('sched-2');
    });

    it('should default to today when no date provided', async () => {
      mockPrisma.schedule.findMany.mockResolvedValue([]);
      mockPrisma.schedule.count.mockResolvedValue(0);
      const today = new Date().toISOString().slice(0, 10);
      const todayObj = new Date(today);
      const todayDow = todayObj.getUTCDay();

      await service.listTrips(DRIVER_ID);

      const call = mockPrisma.schedule.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([{ tripDate: todayObj }, { daysOfWeek: { has: todayDow } }]);
    });

    it('should apply skip/take for page 2', async () => {
      mockPrisma.schedule.findMany.mockResolvedValue([]);
      mockPrisma.schedule.count.mockResolvedValue(30);

      const result = await service.listTrips(DRIVER_ID, TRIP_DATE, 2, 10);

      expect(result.meta).toEqual({ total: 30, page: 2, pageSize: 10, totalPages: 3 });
      expect(mockPrisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('getTripDetail', () => {
    it('should return full detail for assigned schedule', async () => {
      const schedule = makeScheduleRecord();
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.booking.count.mockResolvedValue(5);

      const result = await service.getTripDetail(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(result).toEqual({
        scheduleId: SCHEDULE_ID,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        tripDate: TRIP_DATE_OBJ,
        routeName: 'Bucharest - Cluj',
        busLicensePlate: 'B-123-ABC',
        busModel: 'Mercedes Sprinter',
        status: 'ACTIVE',
        stops: [
          {
            id: 'st-1',
            stopName: 'Bucharest',
            arrivalTime: new Date('2026-03-25T08:00:00Z'),
            departureTime: new Date('2026-03-25T08:05:00Z'),
            orderIndex: 0,
            priceFromStart: 0,
          },
          {
            id: 'st-2',
            stopName: 'Pitesti',
            arrivalTime: new Date('2026-03-25T09:30:00Z'),
            departureTime: new Date('2026-03-25T09:35:00Z'),
            orderIndex: 1,
            priceFromStart: 25,
          },
          {
            id: 'st-3',
            stopName: 'Cluj',
            arrivalTime: new Date('2026-03-25T12:00:00Z'),
            departureTime: new Date('2026-03-25T12:00:00Z'),
            orderIndex: 2,
            priceFromStart: 60,
          },
        ],
        passengerCount: 5,
        totalSeats: 40,
      });
    });

    it('should throw 404 when schedule not found', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      await expect(service.getTripDetail(DRIVER_ID, 'nonexistent', TRIP_DATE)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          detail: 'Schedule not found',
        }),
      );
    });

    it('should throw 404 when driver not assigned to schedule', async () => {
      const schedule = makeScheduleRecord({ driverId: 'other-driver' });
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);

      await expect(service.getTripDetail(DRIVER_ID, SCHEDULE_ID, TRIP_DATE)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          detail: 'Schedule not found',
        }),
      );
    });

    it('should throw 404 when driverId is null on schedule', async () => {
      const schedule = makeScheduleRecord({ driverId: null });
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);

      await expect(service.getTripDetail(DRIVER_ID, SCHEDULE_ID, TRIP_DATE)).rejects.toThrow(
        AppError,
      );
    });

    it('should count only confirmed bookings for the trip date', async () => {
      const schedule = makeScheduleRecord();
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.booking.count.mockResolvedValue(3);

      await service.getTripDetail(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(mockPrisma.booking.count).toHaveBeenCalledWith({
        where: {
          scheduleId: SCHEDULE_ID,
          tripDate: TRIP_DATE_OBJ,
          status: 'CONFIRMED',
        },
      });
    });

    it('should return zero passenger count when no bookings', async () => {
      const schedule = makeScheduleRecord();
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.booking.count.mockResolvedValue(0);

      const result = await service.getTripDetail(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(result.passengerCount).toBe(0);
    });

    it('should include correct bus details', async () => {
      const schedule = makeScheduleRecord({
        bus: { licensePlate: 'X-999-YZ', model: 'Volvo 9700', capacity: 55 },
      });
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.booking.count.mockResolvedValue(0);

      const result = await service.getTripDetail(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(result.busLicensePlate).toBe('X-999-YZ');
      expect(result.busModel).toBe('Volvo 9700');
      expect(result.totalSeats).toBe(55);
    });

    it('should return empty stops array when schedule has no stop times', async () => {
      const schedule = makeScheduleRecord({ stopTimes: [] });
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.booking.count.mockResolvedValue(0);

      const result = await service.getTripDetail(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(result.stops).toEqual([]);
    });

    it('should default to today when no date provided', async () => {
      const schedule = makeScheduleRecord();
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.booking.count.mockResolvedValue(0);
      const today = new Date().toISOString().slice(0, 10);
      const todayObj = new Date(today);

      const result = await service.getTripDetail(DRIVER_ID, SCHEDULE_ID);

      expect(result.tripDate).toEqual(todayObj);
      expect(mockPrisma.booking.count).toHaveBeenCalledWith({
        where: {
          scheduleId: SCHEDULE_ID,
          tripDate: todayObj,
          status: 'CONFIRMED',
        },
      });
    });
  });

  describe('getPassengers', () => {
    const BOOKING_DATE = new Date('2026-03-25T10:00:00Z');

    function makeBookingRecord(overrides: Record<string, unknown> = {}) {
      return {
        id: 'booking-1',
        scheduleId: SCHEDULE_ID,
        tripDate: TRIP_DATE_OBJ,
        status: 'CONFIRMED' as const,
        boardingStop: 'Bucharest',
        alightingStop: 'Cluj',
        createdAt: BOOKING_DATE,
        user: { name: 'Ion Popescu' },
        bookingSeats: [{ seatLabel: 'A1' }, { seatLabel: 'A2' }],
        ...overrides,
      };
    }

    it('should return passengers mapped from confirmed bookings', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue({ driverId: DRIVER_ID });
      const booking1 = makeBookingRecord();
      const booking2 = makeBookingRecord({
        id: 'booking-2',
        boardingStop: 'Pitesti',
        alightingStop: 'Cluj',
        createdAt: new Date('2026-03-25T11:00:00Z'),
        user: { name: 'Maria Ionescu' },
        bookingSeats: [{ seatLabel: 'B3' }],
      });
      mockPrisma.booking.findMany.mockResolvedValue([booking1, booking2]);

      const result = await service.getPassengers(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(result).toEqual([
        {
          bookingId: 'booking-1',
          passengerName: 'Ion Popescu',
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj',
          seatLabels: ['A1', 'A2'],
          status: 'CONFIRMED',
        },
        {
          bookingId: 'booking-2',
          passengerName: 'Maria Ionescu',
          boardingStop: 'Pitesti',
          alightingStop: 'Cluj',
          seatLabels: ['B3'],
          status: 'CONFIRMED',
        },
      ]);
    });

    it('should query bookings with correct filters and ordering', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue({ driverId: DRIVER_ID });
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.getPassengers(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          scheduleId: SCHEDULE_ID,
          tripDate: TRIP_DATE_OBJ,
          status: 'CONFIRMED',
        },
        include: {
          user: { select: { name: true } },
          bookingSeats: { select: { seatLabel: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no bookings exist', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue({ driverId: DRIVER_ID });
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getPassengers(DRIVER_ID, SCHEDULE_ID, TRIP_DATE);

      expect(result).toEqual([]);
    });

    it('should throw 404 when schedule not found', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      await expect(
        service.getPassengers(DRIVER_ID, 'nonexistent', TRIP_DATE),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          detail: 'Schedule not found',
        }),
      );
    });

    it('should throw 404 when driver not assigned to schedule', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue({ driverId: 'other-driver' });

      await expect(
        service.getPassengers(DRIVER_ID, SCHEDULE_ID, TRIP_DATE),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          detail: 'Schedule not found',
        }),
      );
    });

    it('should default to today when no date provided', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue({ driverId: DRIVER_ID });
      mockPrisma.booking.findMany.mockResolvedValue([]);
      const today = new Date().toISOString().slice(0, 10);
      const todayObj = new Date(today);

      await service.getPassengers(DRIVER_ID, SCHEDULE_ID);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tripDate: todayObj }),
        }),
      );
    });
  });
});
