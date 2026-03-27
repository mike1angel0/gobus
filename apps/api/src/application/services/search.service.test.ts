import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService, computeSegmentPrice, computeAvailability } from './search.service.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import type { ScheduleStatus } from '@/generated/prisma/client.js';

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createMockPrisma() {
  return {
    $queryRaw: vi.fn(),
    schedule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    stop: {
      findMany: vi.fn(),
    },
  } as unknown as Parameters<
    typeof SearchService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0];
}

const SCHEDULE_ID = 'schedule-1';
const TRIP_DATE = '2026-03-25';
const TRIP_DATE_OBJ = new Date('2026-03-25');

function makeStopTime(overrides: Record<string, unknown> = {}) {
  return {
    id: 'st-1',
    stopName: 'Bucharest',
    arrivalTime: new Date('2026-03-25T08:00:00Z'),
    departureTime: new Date('2026-03-25T08:05:00Z'),
    orderIndex: 0,
    priceFromStart: 0,
    scheduleId: SCHEDULE_ID,
    ...overrides,
  };
}

function makeSeat(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seat-1',
    row: 1,
    column: 1,
    label: '1A',
    type: 'STANDARD',
    price: 0,
    isEnabled: true,
    busId: 'bus-1',
    ...overrides,
  };
}

function makeScheduleWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    id: SCHEDULE_ID,
    routeId: 'route-1',
    busId: 'bus-1',
    driverId: 'driver-1',
    departureTime: new Date('2026-03-25T08:00:00Z'),
    arrivalTime: new Date('2026-03-25T14:00:00Z'),
    daysOfWeek: [1, 2, 3, 4, 5],
    basePrice: 100,
    status: 'ACTIVE' as ScheduleStatus,
    tripDate: TRIP_DATE_OBJ,
    createdAt: new Date('2024-01-01'),
    stopTimes: [
      makeStopTime({ id: 'st-1', stopName: 'Bucharest', orderIndex: 0, priceFromStart: 0 }),
      makeStopTime({
        id: 'st-2',
        stopName: 'Pitesti',
        orderIndex: 1,
        priceFromStart: 30,
        arrivalTime: new Date('2026-03-25T10:00:00Z'),
        departureTime: new Date('2026-03-25T10:05:00Z'),
      }),
      makeStopTime({
        id: 'st-3',
        stopName: 'Cluj-Napoca',
        orderIndex: 2,
        priceFromStart: 100,
        arrivalTime: new Date('2026-03-25T14:00:00Z'),
        departureTime: new Date('2026-03-25T14:05:00Z'),
      }),
    ],
    route: {
      id: 'route-1',
      name: 'Bucharest - Cluj',
      providerId: 'provider-1',
      createdAt: new Date('2024-01-01'),
      provider: { name: 'TransAlpin' },
    },
    bus: {
      id: 'bus-1',
      seats: [
        makeSeat({ id: 'seat-1', label: '1A' }),
        makeSeat({ id: 'seat-2', label: '1B', column: 2 }),
        makeSeat({ id: 'seat-3', label: '2A', row: 2, isEnabled: false }),
        makeSeat({ id: 'seat-4', label: '2B', row: 2, column: 2, type: 'BLOCKED' }),
      ],
    },
    bookingSeats: [],
    delays: [],
    ...overrides,
  };
}

describe('computeSegmentPrice', () => {
  it('should compute segment price as difference of priceFromStart values', () => {
    expect(computeSegmentPrice(0, 100)).toBe(100);
    expect(computeSegmentPrice(30, 100)).toBe(70);
    expect(computeSegmentPrice(0, 0)).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    expect(computeSegmentPrice(0.1, 100.25)).toBe(100.15);
    expect(computeSegmentPrice(10.333, 50.777)).toBe(40.44);
  });
});

describe('computeAvailability', () => {
  it('should compute available seats correctly', () => {
    expect(computeAvailability(50, 10)).toEqual({ availableSeats: 40, totalSeats: 50 });
    expect(computeAvailability(50, 0)).toEqual({ availableSeats: 50, totalSeats: 50 });
    expect(computeAvailability(50, 50)).toEqual({ availableSeats: 0, totalSeats: 50 });
  });
});

describe('SearchService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: SearchService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new SearchService(prisma);
  });

  describe('searchTrips', () => {
    /** Mock the raw count query and ID query for a given set of schedule IDs. */
    function mockRawQueries(ids: string[]): void {
      // First $queryRaw call: count
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: BigInt(ids.length) }]);
      // Second $queryRaw call: paginated IDs
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(ids.map((id) => ({ id })));
    }

    it('should return matching trips with correct segment pricing', async () => {
      const schedule = makeScheduleWithRelations();
      mockRawQueries([SCHEDULE_ID]);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([schedule]);

      const result = await service.searchTrips({
        origin: 'Bucharest',
        destination: 'Cluj',
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].scheduleId).toBe(SCHEDULE_ID);
      expect(result.data[0].providerName).toBe('TransAlpin');
      expect(result.data[0].routeName).toBe('Bucharest - Cluj');
      expect(result.data[0].origin).toBe('Bucharest');
      expect(result.data[0].destination).toBe('Cluj-Napoca');
      expect(result.data[0].price).toBe(100); // 100 - 0 = 100
      expect(result.data[0].availableSeats).toBe(2); // 2 enabled non-blocked seats
      expect(result.data[0].totalSeats).toBe(2);
      expect(result.meta.total).toBe(1);
    });

    it('should exclude trips where origin comes after destination', async () => {
      // DB returns 0 count — reversed stops don't match the SQL join condition
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.searchTrips({
        origin: 'Cluj',
        destination: 'Bucharest',
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(0);
    });

    it('should compute correct availability with booked seats', async () => {
      const schedule = makeScheduleWithRelations({
        bookingSeats: [{ seatLabel: '1A' }],
      });
      mockRawQueries([SCHEDULE_ID]);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([schedule]);

      const result = await service.searchTrips({
        origin: 'Bucharest',
        destination: 'Cluj',
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      expect(result.data[0].availableSeats).toBe(1); // 2 enabled - 1 booked
      expect(result.data[0].totalSeats).toBe(2);
    });

    it('should return empty results when no schedules match', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.searchTrips({
        origin: 'Nonexistent',
        destination: 'Nowhere',
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should exclude trips where destination stop is not found in findMany results', async () => {
      // DB raw query finds a match, but findMany results don't have destination stop
      // (edge case: data inconsistency between raw and ORM queries)
      const schedule = makeScheduleWithRelations();
      mockRawQueries([SCHEDULE_ID]);
      // Remove the destination stop from stopTimes to simulate mismatch
      const noDestSchedule = {
        ...schedule,
        stopTimes: schedule.stopTimes.filter((st) => st.stopName !== 'Cluj-Napoca'),
      };
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([noDestSchedule]);

      const result = await service.searchTrips({
        origin: 'Bucharest',
        destination: 'Sibiu', // Not in the stops
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(0);
    });

    it('should paginate results via DB-level skip/take', async () => {
      // Total of 3, page 2 with pageSize 2 → DB returns 1 ID
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: BigInt(3) }]);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: 'schedule-3' }]);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([
        makeScheduleWithRelations({ id: 'schedule-3' }),
      ]);

      const result = await service.searchTrips({
        origin: 'Bucharest',
        destination: 'Cluj',
        date: TRIP_DATE,
        page: 2,
        pageSize: 2,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].scheduleId).toBe('schedule-3');
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(2);
      expect(result.meta.pageSize).toBe(2);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should match stops case-insensitively', async () => {
      const schedule = makeScheduleWithRelations();
      mockRawQueries([SCHEDULE_ID]);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([schedule]);

      const result = await service.searchTrips({
        origin: 'bucharest',
        destination: 'cluj',
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
    });

    it('should compute segment pricing for intermediate stops', async () => {
      const schedule = makeScheduleWithRelations();
      mockRawQueries([SCHEDULE_ID]);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([schedule]);

      const result = await service.searchTrips({
        origin: 'Bucharest',
        destination: 'Pitesti',
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].price).toBe(30); // 30 - 0 = 30
    });

    it('should use separate count query without includes for total', async () => {
      mockRawQueries([SCHEDULE_ID]);
      vi.mocked(prisma.schedule.findMany).mockResolvedValue([makeScheduleWithRelations()]);

      await service.searchTrips({
        origin: 'Bucharest',
        destination: 'Cluj',
        date: TRIP_DATE,
        page: 1,
        pageSize: 20,
      });

      // $queryRaw called twice: once for count, once for IDs
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      // findMany called once for full data of paginated subset
      expect(prisma.schedule.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTripDetails', () => {
    it('should return trip details with seat availability map', async () => {
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(schedule);

      const result = await service.getTripDetails(SCHEDULE_ID, TRIP_DATE);

      expect(result.scheduleId).toBe(SCHEDULE_ID);
      expect(result.routeName).toBe('Bucharest - Cluj');
      expect(result.providerName).toBe('TransAlpin');
      expect(result.basePrice).toBe(100);
      expect(result.status).toBe('ACTIVE');
      expect(result.stopTimes).toHaveLength(3);
      expect(result.seats).toHaveLength(4);
      expect(result.seats[0].isBooked).toBe(false);
    });

    it('should mark booked seats correctly', async () => {
      const schedule = makeScheduleWithRelations({
        bookingSeats: [{ seatLabel: '1A' }, { seatLabel: '2A' }],
      });
      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(schedule);

      const result = await service.getTripDetails(SCHEDULE_ID, TRIP_DATE);

      const seat1A = result.seats.find((s) => s.label === '1A');
      const seat1B = result.seats.find((s) => s.label === '1B');
      const seat2A = result.seats.find((s) => s.label === '2A');
      expect(seat1A?.isBooked).toBe(true);
      expect(seat1B?.isBooked).toBe(false);
      expect(seat2A?.isBooked).toBe(true);
    });

    it('should throw RESOURCE_NOT_FOUND when schedule does not exist', async () => {
      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(null);

      await expect(service.getTripDetails('nonexistent', TRIP_DATE)).rejects.toThrow(AppError);

      try {
        await service.getTripDetails('nonexistent', TRIP_DATE);
      } catch (err) {
        const appError = err as AppError;
        expect(appError.statusCode).toBe(404);
        expect(appError.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      }
    });

    it('should return correct stop times ordered by index', async () => {
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(schedule);

      const result = await service.getTripDetails(SCHEDULE_ID, TRIP_DATE);

      expect(result.stopTimes[0].stopName).toBe('Bucharest');
      expect(result.stopTimes[0].orderIndex).toBe(0);
      expect(result.stopTimes[1].stopName).toBe('Pitesti');
      expect(result.stopTimes[1].orderIndex).toBe(1);
      expect(result.stopTimes[2].stopName).toBe('Cluj-Napoca');
      expect(result.stopTimes[2].orderIndex).toBe(2);
    });

    it('should return all seats with their properties', async () => {
      const schedule = makeScheduleWithRelations();
      vi.mocked(prisma.schedule.findUnique).mockResolvedValue(schedule);

      const result = await service.getTripDetails(SCHEDULE_ID, TRIP_DATE);

      const disabledSeat = result.seats.find((s) => s.label === '2A');
      expect(disabledSeat?.isEnabled).toBe(false);

      const blockedSeat = result.seats.find((s) => s.label === '2B');
      expect(blockedSeat?.type).toBe('BLOCKED');
    });
  });

  describe('listCities', () => {
    it('returns sorted distinct city names', async () => {
      const mockPrisma = createMockPrisma();
      const service = new SearchService(mockPrisma);

      vi.mocked(
        (mockPrisma as unknown as { stop: { findMany: ReturnType<typeof vi.fn> } }).stop.findMany,
      ).mockResolvedValue([
        { name: 'Alba Iulia' },
        { name: 'Brașov' },
        { name: 'București' },
        { name: 'Cluj-Napoca' },
      ]);

      const result = await service.listCities();

      expect(result).toEqual(['Alba Iulia', 'Brașov', 'București', 'Cluj-Napoca']);
    });

    it('returns empty array when no stops exist', async () => {
      const mockPrisma = createMockPrisma();
      const service = new SearchService(mockPrisma);

      vi.mocked(
        (mockPrisma as unknown as { stop: { findMany: ReturnType<typeof vi.fn> } }).stop.findMany,
      ).mockResolvedValue([]);

      const result = await service.listCities();

      expect(result).toEqual([]);
    });
  });
});
