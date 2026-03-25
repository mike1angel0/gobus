import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DelayService, type DelayUser, type CreateDelayInput } from './delay.service.js';
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
const PROVIDER_ID = 'provider-1';
const SCHEDULE_ID = 'schedule-1';
const DELAY_ID = 'delay-1';
const TRIP_DATE = '2026-03-25';
const TRIP_DATE_OBJ = new Date('2026-03-25');
const CREATED_AT = new Date('2026-03-25T10:00:00Z');

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: SCHEDULE_ID,
    driverId: DRIVER_ID,
    route: { providerId: PROVIDER_ID },
    ...overrides,
  };
}

function makeDelayRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: DELAY_ID,
    scheduleId: SCHEDULE_ID,
    offsetMinutes: 15,
    reason: 'TRAFFIC' as const,
    note: null,
    tripDate: TRIP_DATE_OBJ,
    active: true,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateDelayInput> = {}): CreateDelayInput {
  return {
    scheduleId: SCHEDULE_ID,
    offsetMinutes: 15,
    reason: 'TRAFFIC',
    tripDate: TRIP_DATE,
    ...overrides,
  };
}

function makeDriverUser(overrides: Partial<DelayUser> = {}): DelayUser {
  return {
    id: DRIVER_ID,
    role: 'DRIVER',
    providerId: PROVIDER_ID,
    ...overrides,
  };
}

function makeProviderUser(overrides: Partial<DelayUser> = {}): DelayUser {
  return {
    id: 'provider-user-1',
    role: 'PROVIDER',
    providerId: PROVIDER_ID,
    ...overrides,
  };
}

describe('DelayService', () => {
  let service: DelayService;
  let mockTx: {
    delay: {
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let mockPrisma: {
    delay: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    schedule: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockTx = {
      delay: {
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    mockPrisma = {
      delay: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      schedule: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    };
    service = new DelayService(mockPrisma as never);
  });

  describe('getBySchedule', () => {
    it('should return active delays for a schedule and trip date', async () => {
      const records = [
        makeDelayRecord({ id: 'delay-1' }),
        makeDelayRecord({ id: 'delay-2', offsetMinutes: 30, reason: 'WEATHER' }),
      ];
      mockPrisma.delay.findMany.mockResolvedValue(records);

      const result = await service.getBySchedule(SCHEDULE_ID, TRIP_DATE);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('delay-1');
      expect(result[0].offsetMinutes).toBe(15);
      expect(result[1].id).toBe('delay-2');
      expect(result[1].offsetMinutes).toBe(30);
      expect(result[1].reason).toBe('WEATHER');

      expect(mockPrisma.delay.findMany).toHaveBeenCalledWith({
        where: {
          scheduleId: SCHEDULE_ID,
          tripDate: TRIP_DATE_OBJ,
          active: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no delays exist', async () => {
      mockPrisma.delay.findMany.mockResolvedValue([]);

      const result = await service.getBySchedule(SCHEDULE_ID, TRIP_DATE);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create delay when driver is assigned to schedule', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(makeSchedule());
      mockTx.delay.updateMany.mockResolvedValue({ count: 0 });
      const record = makeDelayRecord();
      mockTx.delay.create.mockResolvedValue(record);

      const result = await service.create(makeDriverUser(), makeCreateInput());

      expect(result).toEqual({
        id: DELAY_ID,
        scheduleId: SCHEDULE_ID,
        offsetMinutes: 15,
        reason: 'TRAFFIC',
        note: null,
        tripDate: TRIP_DATE_OBJ,
        active: true,
        createdAt: CREATED_AT,
      });
    });

    it('should create delay when provider owns schedule', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(makeSchedule());
      mockTx.delay.updateMany.mockResolvedValue({ count: 0 });
      const record = makeDelayRecord();
      mockTx.delay.create.mockResolvedValue(record);

      const result = await service.create(makeProviderUser(), makeCreateInput());

      expect(result.id).toBe(DELAY_ID);
    });

    it('should deactivate previous active delays atomically', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(makeSchedule());
      mockTx.delay.updateMany.mockResolvedValue({ count: 2 });
      mockTx.delay.create.mockResolvedValue(makeDelayRecord());

      await service.create(makeDriverUser(), makeCreateInput());

      expect(mockTx.delay.updateMany).toHaveBeenCalledWith({
        where: { scheduleId: SCHEDULE_ID, tripDate: TRIP_DATE_OBJ, active: true },
        data: { active: false },
      });
    });

    it('should create delay with optional note', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(makeSchedule());
      mockTx.delay.updateMany.mockResolvedValue({ count: 0 });
      const record = makeDelayRecord({ note: 'Traffic jam on highway' });
      mockTx.delay.create.mockResolvedValue(record);

      const result = await service.create(
        makeDriverUser(),
        makeCreateInput({ note: 'Traffic jam on highway' }),
      );

      expect(result.note).toBe('Traffic jam on highway');
      expect(mockTx.delay.create).toHaveBeenCalledWith({
        data: {
          scheduleId: SCHEDULE_ID,
          offsetMinutes: 15,
          reason: 'TRAFFIC',
          note: 'Traffic jam on highway',
          tripDate: TRIP_DATE_OBJ,
          active: true,
        },
      });
    });

    it('should set note to null when not provided', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(makeSchedule());
      mockTx.delay.updateMany.mockResolvedValue({ count: 0 });
      mockTx.delay.create.mockResolvedValue(makeDelayRecord());

      await service.create(makeDriverUser(), makeCreateInput());

      expect(mockTx.delay.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ note: null }),
      });
    });

    it('should throw 404 when schedule does not exist', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      await expect(service.create(makeDriverUser(), makeCreateInput())).rejects.toThrow(AppError);
      await expect(service.create(makeDriverUser(), makeCreateInput())).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Schedule not found',
      });
    });

    it('should throw 403 when driver is not assigned to schedule', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(
        makeSchedule({ driverId: 'other-driver' }),
      );

      await expect(service.create(makeDriverUser(), makeCreateInput())).rejects.toThrow(AppError);
      await expect(service.create(makeDriverUser(), makeCreateInput())).rejects.toMatchObject({
        statusCode: 403,
        code: ErrorCodes.FORBIDDEN,
        detail: 'Not assigned to this schedule',
      });
    });

    it('should throw 404 when provider does not own schedule', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(
        makeSchedule({ route: { providerId: 'other-provider' } }),
      );

      await expect(service.create(makeProviderUser(), makeCreateInput())).rejects.toThrow(AppError);
      await expect(service.create(makeProviderUser(), makeCreateInput())).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Schedule not found',
      });
    });

    it('should throw 403 for passenger role', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(makeSchedule());

      const passengerUser: DelayUser = { id: 'user-1', role: 'PASSENGER', providerId: null };

      await expect(service.create(passengerUser, makeCreateInput())).rejects.toThrow(AppError);
      await expect(service.create(passengerUser, makeCreateInput())).rejects.toMatchObject({
        statusCode: 403,
        code: ErrorCodes.FORBIDDEN,
      });
    });

    it('should use transaction for atomic deactivation and creation', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(makeSchedule());
      mockTx.delay.updateMany.mockResolvedValue({ count: 1 });
      mockTx.delay.create.mockResolvedValue(makeDelayRecord());

      await service.create(makeDriverUser(), makeCreateInput());

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.delay.updateMany).toHaveBeenCalledTimes(1);
      expect(mockTx.delay.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should update delay when provider owns the schedule', async () => {
      const delay = {
        ...makeDelayRecord(),
        schedule: { route: { providerId: PROVIDER_ID } },
      };
      mockPrisma.delay.findUnique.mockResolvedValue(delay);
      mockPrisma.delay.update.mockResolvedValue(
        makeDelayRecord({ offsetMinutes: 30, reason: 'MECHANICAL' }),
      );

      const result = await service.update(DELAY_ID, PROVIDER_ID, {
        offsetMinutes: 30,
        reason: 'MECHANICAL',
      });

      expect(result.offsetMinutes).toBe(30);
      expect(result.reason).toBe('MECHANICAL');
      expect(mockPrisma.delay.update).toHaveBeenCalledWith({
        where: { id: DELAY_ID },
        data: { offsetMinutes: 30, reason: 'MECHANICAL' },
      });
    });

    it('should update only provided fields', async () => {
      const delay = {
        ...makeDelayRecord(),
        schedule: { route: { providerId: PROVIDER_ID } },
      };
      mockPrisma.delay.findUnique.mockResolvedValue(delay);
      mockPrisma.delay.update.mockResolvedValue(makeDelayRecord({ active: false }));

      const result = await service.update(DELAY_ID, PROVIDER_ID, { active: false });

      expect(result.active).toBe(false);
      expect(mockPrisma.delay.update).toHaveBeenCalledWith({
        where: { id: DELAY_ID },
        data: { active: false },
      });
    });

    it('should allow setting note to null', async () => {
      const delay = {
        ...makeDelayRecord({ note: 'old note' }),
        schedule: { route: { providerId: PROVIDER_ID } },
      };
      mockPrisma.delay.findUnique.mockResolvedValue(delay);
      mockPrisma.delay.update.mockResolvedValue(makeDelayRecord({ note: null }));

      const result = await service.update(DELAY_ID, PROVIDER_ID, { note: null });

      expect(result.note).toBeNull();
      expect(mockPrisma.delay.update).toHaveBeenCalledWith({
        where: { id: DELAY_ID },
        data: { note: null },
      });
    });

    it('should throw 404 when delay does not exist', async () => {
      mockPrisma.delay.findUnique.mockResolvedValue(null);

      await expect(
        service.update(DELAY_ID, PROVIDER_ID, { offsetMinutes: 30 }),
      ).rejects.toThrow(AppError);
      await expect(
        service.update(DELAY_ID, PROVIDER_ID, { offsetMinutes: 30 }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Delay not found',
      });
    });

    it('should throw 404 when provider does not own the schedule', async () => {
      const delay = {
        ...makeDelayRecord(),
        schedule: { route: { providerId: 'other-provider' } },
      };
      mockPrisma.delay.findUnique.mockResolvedValue(delay);

      await expect(
        service.update(DELAY_ID, PROVIDER_ID, { offsetMinutes: 30 }),
      ).rejects.toThrow(AppError);
      await expect(
        service.update(DELAY_ID, PROVIDER_ID, { offsetMinutes: 30 }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Delay not found',
      });
    });

    it('should pass empty data object when no fields provided', async () => {
      const delay = {
        ...makeDelayRecord(),
        schedule: { route: { providerId: PROVIDER_ID } },
      };
      mockPrisma.delay.findUnique.mockResolvedValue(delay);
      mockPrisma.delay.update.mockResolvedValue(makeDelayRecord());

      await service.update(DELAY_ID, PROVIDER_ID, {});

      expect(mockPrisma.delay.update).toHaveBeenCalledWith({
        where: { id: DELAY_ID },
        data: {},
      });
    });
  });
});
