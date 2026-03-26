import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleService } from './schedule.service.js';
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

function createMockPrisma() {
  return {
    schedule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    route: {
      findUnique: vi.fn(),
    },
    bus: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        schedule: {
          create: vi.fn(),
        },
      }),
    ),
  } as unknown as Parameters<
    typeof ScheduleService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0];
}

const PROVIDER_ID = 'provider-1';
const OTHER_PROVIDER_ID = 'provider-2';
const SCHEDULE_ID = 'schedule-1';
const ROUTE_ID = 'route-1';
const BUS_ID = 'bus-1';
const DRIVER_ID = 'driver-1';

const BASE_DATE = new Date('2024-06-15T08:00:00Z');
const END_DATE = new Date('2024-06-15T14:00:00Z');
const TRIP_DATE = new Date('2024-06-15');
const CREATED_AT = new Date('2024-01-01');

function makeRoute(overrides: Record<string, unknown> = {}) {
  return {
    id: ROUTE_ID,
    name: 'Bucharest - Cluj',
    providerId: PROVIDER_ID,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makeBus(overrides: Record<string, unknown> = {}) {
  return {
    id: BUS_ID,
    licensePlate: 'B-123-ABC',
    model: 'Mercedes Tourismo',
    capacity: 52,
    rows: 13,
    columns: 4,
    providerId: PROVIDER_ID,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makeDriver(overrides: Record<string, unknown> = {}) {
  return {
    id: DRIVER_ID,
    name: 'Ion Popescu',
    email: 'ion@example.com',
    role: 'DRIVER',
    providerId: PROVIDER_ID,
    ...overrides,
  };
}

function makeStopTime(overrides: Record<string, unknown> = {}) {
  return {
    id: 'st-1',
    stopName: 'Bucharest',
    arrivalTime: BASE_DATE,
    departureTime: BASE_DATE,
    orderIndex: 0,
    priceFromStart: 0,
    lat: null,
    lng: null,
    scheduleId: SCHEDULE_ID,
    ...overrides,
  };
}

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: SCHEDULE_ID,
    routeId: ROUTE_ID,
    busId: BUS_ID,
    driverId: DRIVER_ID,
    departureTime: BASE_DATE,
    arrivalTime: END_DATE,
    daysOfWeek: [1, 3, 5],
    basePrice: 50,
    status: 'ACTIVE',
    tripDate: TRIP_DATE,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makeScheduleWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    ...makeSchedule(),
    stopTimes: [
      makeStopTime(),
      makeStopTime({
        id: 'st-2',
        stopName: 'Cluj',
        arrivalTime: END_DATE,
        departureTime: END_DATE,
        orderIndex: 1,
        priceFromStart: 50,
      }),
    ],
    route: makeRoute(),
    bus: makeBus(),
    driver: makeDriver(),
    ...overrides,
  };
}

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ScheduleService(prisma as never);
  });

  // ─── listByProvider ────────────────────────────────────────────

  describe('listByProvider', () => {
    it('should return paginated schedules for the provider', async () => {
      const schedules = [makeSchedule(), makeSchedule({ id: 'schedule-2' })];
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(schedules);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: SCHEDULE_ID,
        routeId: ROUTE_ID,
        busId: BUS_ID,
        driverId: DRIVER_ID,
        departureTime: BASE_DATE,
        arrivalTime: END_DATE,
        daysOfWeek: [1, 3, 5],
        basePrice: 50,
        status: 'ACTIVE',
        tripDate: TRIP_DATE,
        createdAt: CREATED_AT,
      });
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(prisma.schedule.findMany).toHaveBeenCalledWith({
        where: { route: { providerId: PROVIDER_ID } },
        orderBy: { tripDate: 'desc' },
        skip: 0,
        take: 20,
        select: {
          id: true,
          routeId: true,
          busId: true,
          driverId: true,
          departureTime: true,
          arrivalTime: true,
          daysOfWeek: true,
          basePrice: true,
          status: true,
          tripDate: true,
          createdAt: true,
        },
      });
    });

    it('should apply routeId filter', async () => {
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 }, { routeId: ROUTE_ID });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { route: { providerId: PROVIDER_ID }, routeId: ROUTE_ID },
        }),
      );
    });

    it('should apply busId filter', async () => {
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 }, { busId: BUS_ID });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { route: { providerId: PROVIDER_ID }, busId: BUS_ID },
        }),
      );
    });

    it('should apply status filter', async () => {
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 }, { status: 'CANCELLED' });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { route: { providerId: PROVIDER_ID }, status: 'CANCELLED' },
        }),
      );
    });

    it('should apply date range filters', async () => {
      const fromDate = new Date('2024-06-01');
      const toDate = new Date('2024-06-30');
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 }, { fromDate, toDate });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            route: { providerId: PROVIDER_ID },
            tripDate: { gte: fromDate, lte: toDate },
          },
        }),
      );
    });

    it('should apply only fromDate filter when toDate is omitted', async () => {
      const fromDate = new Date('2024-06-01');
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 }, { fromDate });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            route: { providerId: PROVIDER_ID },
            tripDate: { gte: fromDate },
          },
        }),
      );
    });

    it('should apply only toDate filter when fromDate is omitted', async () => {
      const toDate = new Date('2024-06-30');
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 }, { toDate });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            route: { providerId: PROVIDER_ID },
            tripDate: { lte: toDate },
          },
        }),
      );
    });

    it('should return empty list when no schedules exist', async () => {
      (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ─── getById ───────────────────────────────────────────────────

  describe('getById', () => {
    it('should return schedule with details when found and owned', async () => {
      const schedule = makeScheduleWithRelations();
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(schedule);

      const result = await service.getById(SCHEDULE_ID, PROVIDER_ID);

      expect(result.id).toBe(SCHEDULE_ID);
      expect(result.routeId).toBe(ROUTE_ID);
      expect(result.busId).toBe(BUS_ID);
      expect(result.driverId).toBe(DRIVER_ID);
      expect(result.stopTimes).toHaveLength(2);
      expect(result.stopTimes[0]).toEqual({
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: BASE_DATE,
        departureTime: BASE_DATE,
        orderIndex: 0,
        priceFromStart: 0,
        lat: null,
        lng: null,
      });
      expect(result.route).toEqual({
        id: ROUTE_ID,
        name: 'Bucharest - Cluj',
        providerId: PROVIDER_ID,
        createdAt: CREATED_AT,
      });
      expect(result.bus).toEqual({
        id: BUS_ID,
        licensePlate: 'B-123-ABC',
        model: 'Mercedes Tourismo',
        capacity: 52,
        rows: 13,
        columns: 4,
        providerId: PROVIDER_ID,
        createdAt: CREATED_AT,
      });
      expect(result.driver).toEqual({
        id: DRIVER_ID,
        name: 'Ion Popescu',
      });
    });

    it('should return null driver when no driver assigned', async () => {
      const schedule = makeScheduleWithRelations({ driverId: null, driver: null });
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(schedule);

      const result = await service.getById(SCHEDULE_ID, PROVIDER_ID);

      expect(result.driver).toBeNull();
    });

    it('should throw RESOURCE_NOT_FOUND when schedule does not exist', async () => {
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getById('nonexistent', PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.getById('nonexistent', PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when schedule belongs to another provider', async () => {
      const schedule = makeScheduleWithRelations({
        route: makeRoute({ providerId: OTHER_PROVIDER_ID }),
      });
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(schedule);

      await expect(service.getById(SCHEDULE_ID, PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.getById(SCHEDULE_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Schedule not found',
      });
    });
  });

  // ─── create ────────────────────────────────────────────────────

  describe('create', () => {
    const createData = {
      routeId: ROUTE_ID,
      busId: BUS_ID,
      driverId: DRIVER_ID,
      departureTime: BASE_DATE,
      arrivalTime: END_DATE,
      daysOfWeek: [1, 3, 5],
      basePrice: 50,
      tripDate: TRIP_DATE,
      stopTimes: [
        {
          stopName: 'Bucharest',
          arrivalTime: BASE_DATE,
          departureTime: BASE_DATE,
          orderIndex: 0,
          priceFromStart: 0,
        },
        {
          stopName: 'Cluj',
          arrivalTime: END_DATE,
          departureTime: END_DATE,
          orderIndex: 1,
          priceFromStart: 50,
        },
      ],
    };

    it('should create schedule with stop times in a transaction', async () => {
      const createdSchedule = makeScheduleWithRelations();
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
        role: 'DRIVER',
      });

      const mockTxCreate = vi.fn().mockResolvedValue(createdSchedule);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) => fn({ schedule: { create: mockTxCreate } }),
      );

      const result = await service.create(PROVIDER_ID, createData);

      expect(result.id).toBe(SCHEDULE_ID);
      expect(result.stopTimes).toHaveLength(2);
      expect(result.route.id).toBe(ROUTE_ID);
      expect(result.bus.id).toBe(BUS_ID);
      expect(result.driver?.id).toBe(DRIVER_ID);
      expect(mockTxCreate).toHaveBeenCalledWith({
        data: {
          routeId: ROUTE_ID,
          busId: BUS_ID,
          driverId: DRIVER_ID,
          departureTime: BASE_DATE,
          arrivalTime: END_DATE,
          daysOfWeek: [1, 3, 5],
          basePrice: 50,
          tripDate: TRIP_DATE,
          stopTimes: {
            create: [
              {
                stopName: 'Bucharest',
                arrivalTime: BASE_DATE,
                departureTime: BASE_DATE,
                orderIndex: 0,
                priceFromStart: 0,
                lat: null,
                lng: null,
              },
              {
                stopName: 'Cluj',
                arrivalTime: END_DATE,
                departureTime: END_DATE,
                orderIndex: 1,
                priceFromStart: 50,
                lat: null,
                lng: null,
              },
            ],
          },
        },
        include: {
          stopTimes: { orderBy: { orderIndex: 'asc' } },
          route: true,
          bus: true,
          driver: { select: { id: true, name: true } },
        },
      });
    });

    it('should create schedule without driver when driverId is omitted', async () => {
      const createdSchedule = makeScheduleWithRelations({ driverId: null, driver: null });
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });

      const mockTxCreate = vi.fn().mockResolvedValue(createdSchedule);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) => fn({ schedule: { create: mockTxCreate } }),
      );

      const { driverId: _unused, ...dataWithoutDriver } = createData;
      const result = await service.create(PROVIDER_ID, dataWithoutDriver);

      expect(result.driver).toBeNull();
      expect(mockTxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ driverId: null }),
        }),
      );
      // Should not call user.findUnique for driver validation
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw RESOURCE_NOT_FOUND when route does not belong to provider', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
      });

      await expect(service.create(PROVIDER_ID, createData)).rejects.toThrow(AppError);
      await expect(service.create(PROVIDER_ID, createData)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Route not found',
      });
    });

    it('should throw RESOURCE_NOT_FOUND when route does not exist', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.create(PROVIDER_ID, createData)).rejects.toThrow(AppError);
      await expect(service.create(PROVIDER_ID, createData)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Route not found',
      });
    });

    it('should throw RESOURCE_NOT_FOUND when bus does not belong to provider', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
      });

      await expect(service.create(PROVIDER_ID, createData)).rejects.toThrow(AppError);
      await expect(service.create(PROVIDER_ID, createData)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Bus not found',
      });
    });

    it('should throw RESOURCE_NOT_FOUND when driver does not belong to provider', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
        role: 'DRIVER',
      });

      await expect(service.create(PROVIDER_ID, createData)).rejects.toThrow(AppError);
      await expect(service.create(PROVIDER_ID, createData)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Driver not found',
      });
    });

    it('should throw RESOURCE_NOT_FOUND when driverId references a non-driver user', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
        role: 'PASSENGER',
      });

      await expect(service.create(PROVIDER_ID, createData)).rejects.toThrow(AppError);
      await expect(service.create(PROVIDER_ID, createData)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Driver not found',
      });
    });
  });

  // ─── update ────────────────────────────────────────────────────

  describe('update', () => {
    it('should update schedule driver assignment', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
        role: 'DRIVER',
      });

      const updated = makeScheduleWithRelations({ driverId: 'driver-2' });
      (prisma.schedule.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update(SCHEDULE_ID, PROVIDER_ID, { driverId: 'driver-2' });

      expect(result.id).toBe(SCHEDULE_ID);
      expect(prisma.schedule.update).toHaveBeenCalledWith({
        where: { id: SCHEDULE_ID },
        data: { driverId: 'driver-2' },
        include: {
          stopTimes: { orderBy: { orderIndex: 'asc' } },
          route: true,
          bus: true,
          driver: { select: { id: true, name: true } },
        },
      });
    });

    it('should unassign driver when driverId is null', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const updated = makeScheduleWithRelations({ driverId: null, driver: null });
      (prisma.schedule.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update(SCHEDULE_ID, PROVIDER_ID, { driverId: null });

      expect(result.driver).toBeNull();
      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { driverId: null },
        }),
      );
      // Should not validate driver when unassigning
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should update schedule departure and arrival times', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const newDeparture = new Date('2024-06-15T09:00:00Z');
      const newArrival = new Date('2024-06-15T15:00:00Z');
      const updated = makeScheduleWithRelations({
        departureTime: newDeparture,
        arrivalTime: newArrival,
      });
      (prisma.schedule.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update(SCHEDULE_ID, PROVIDER_ID, {
        departureTime: newDeparture,
        arrivalTime: newArrival,
      });

      expect(result.departureTime).toBe(newDeparture);
      expect(result.arrivalTime).toBe(newArrival);
      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { departureTime: newDeparture, arrivalTime: newArrival },
        }),
      );
    });

    it('should update only departureTime when arrivalTime is omitted', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const newDeparture = new Date('2024-06-15T09:00:00Z');
      const updated = makeScheduleWithRelations({ departureTime: newDeparture });
      (prisma.schedule.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update(SCHEDULE_ID, PROVIDER_ID, {
        departureTime: newDeparture,
      });

      expect(result.departureTime).toBe(newDeparture);
      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { departureTime: newDeparture },
        }),
      );
    });

    it('should update schedule status', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const updated = makeScheduleWithRelations({ status: 'CANCELLED' });
      (prisma.schedule.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update(SCHEDULE_ID, PROVIDER_ID, { status: 'CANCELLED' });

      expect(result.status).toBe('CANCELLED');
      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED' },
        }),
      );
    });

    it('should throw RESOURCE_NOT_FOUND when schedule does not exist', async () => {
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', PROVIDER_ID, { status: 'CANCELLED' }),
      ).rejects.toThrow(AppError);
      await expect(
        service.update('nonexistent', PROVIDER_ID, { status: 'CANCELLED' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when schedule belongs to another provider', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: OTHER_PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await expect(
        service.update(SCHEDULE_ID, PROVIDER_ID, { status: 'CANCELLED' }),
      ).rejects.toThrow(AppError);
      await expect(
        service.update(SCHEDULE_ID, PROVIDER_ID, { status: 'CANCELLED' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Schedule not found',
      });
    });

    it('should throw RESOURCE_NOT_FOUND when driver does not belong to provider', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
        role: 'DRIVER',
      });

      await expect(
        service.update(SCHEDULE_ID, PROVIDER_ID, { driverId: 'driver-other' }),
      ).rejects.toThrow(AppError);
      await expect(
        service.update(SCHEDULE_ID, PROVIDER_ID, { driverId: 'driver-other' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Driver not found',
      });
    });
  });

  // ─── cancel ────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should cancel schedule when owned', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.schedule.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...makeSchedule(),
        status: 'CANCELLED',
      });

      await service.cancel(SCHEDULE_ID, PROVIDER_ID);

      expect(prisma.schedule.update).toHaveBeenCalledWith({
        where: { id: SCHEDULE_ID },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw RESOURCE_NOT_FOUND when schedule does not exist', async () => {
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.cancel('nonexistent', PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.cancel('nonexistent', PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when schedule belongs to another provider', async () => {
      const existing = {
        ...makeSchedule(),
        route: { providerId: OTHER_PROVIDER_ID },
      };
      (prisma.schedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await expect(service.cancel(SCHEDULE_ID, PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.cancel(SCHEDULE_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Schedule not found',
      });
    });
  });
});
