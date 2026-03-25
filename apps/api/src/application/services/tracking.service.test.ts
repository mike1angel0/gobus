import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingService } from './tracking.service.js';
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
const BUS_ID = 'bus-1';
const SCHEDULE_ID = 'schedule-1';
const PROVIDER_ID = 'provider-1';
const TRACKING_ID = 'tracking-1';

function makeTrackingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: TRACKING_ID,
    busId: BUS_ID,
    lat: 44.4268,
    lng: 26.1025,
    speed: 60,
    heading: 90,
    scheduleId: SCHEDULE_ID,
    currentStopIndex: 2,
    isActive: true,
    tripDate: new Date('2026-03-25'),
    updatedAt: new Date('2026-03-25T10:00:00Z'),
    ...overrides,
  };
}

function makeUpdateInput(overrides: Record<string, unknown> = {}) {
  return {
    busId: BUS_ID,
    lat: 44.4268,
    lng: 26.1025,
    speed: 60,
    heading: 90,
    currentStopIndex: 2,
    tripDate: '2026-03-25',
    ...overrides,
  };
}

describe('TrackingService', () => {
  let service: TrackingService;
  let mockPrisma: {
    bus: { findUnique: ReturnType<typeof vi.fn> };
    schedule: { findFirst: ReturnType<typeof vi.fn> };
    busTracking: {
      upsert: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      bus: { findUnique: vi.fn() },
      schedule: { findFirst: vi.fn() },
      busTracking: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new TrackingService(mockPrisma as never);
  });

  describe('updatePosition', () => {
    it('should upsert tracking record when driver is assigned', async () => {
      mockPrisma.bus.findUnique.mockResolvedValue({ id: BUS_ID });
      mockPrisma.schedule.findFirst.mockResolvedValue({ id: SCHEDULE_ID });
      const record = makeTrackingRecord();
      mockPrisma.busTracking.upsert.mockResolvedValue(record);

      const result = await service.updatePosition(DRIVER_ID, makeUpdateInput());

      expect(result).toEqual({
        id: TRACKING_ID,
        busId: BUS_ID,
        lat: 44.4268,
        lng: 26.1025,
        speed: 60,
        heading: 90,
        scheduleId: SCHEDULE_ID,
        currentStopIndex: 2,
        isActive: true,
        tripDate: new Date('2026-03-25'),
        updatedAt: new Date('2026-03-25T10:00:00Z'),
      });

      expect(mockPrisma.busTracking.upsert).toHaveBeenCalledWith({
        where: { busId: BUS_ID },
        create: {
          busId: BUS_ID,
          lat: 44.4268,
          lng: 26.1025,
          speed: 60,
          heading: 90,
          currentStopIndex: 2,
          scheduleId: SCHEDULE_ID,
          tripDate: new Date('2026-03-25'),
          isActive: true,
        },
        update: {
          lat: 44.4268,
          lng: 26.1025,
          speed: 60,
          heading: 90,
          currentStopIndex: 2,
          scheduleId: SCHEDULE_ID,
          tripDate: new Date('2026-03-25'),
          isActive: true,
        },
      });
    });

    it('should infer scheduleId from assignment when not provided', async () => {
      mockPrisma.bus.findUnique.mockResolvedValue({ id: BUS_ID });
      mockPrisma.schedule.findFirst.mockResolvedValue({ id: 'inferred-schedule' });
      mockPrisma.busTracking.upsert.mockResolvedValue(
        makeTrackingRecord({ scheduleId: 'inferred-schedule' }),
      );

      const input = makeUpdateInput();
      delete (input as Record<string, unknown>).scheduleId;

      const result = await service.updatePosition(DRIVER_ID, input);

      expect(result.scheduleId).toBe('inferred-schedule');
      expect(mockPrisma.busTracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ scheduleId: 'inferred-schedule' }),
          update: expect.objectContaining({ scheduleId: 'inferred-schedule' }),
        }),
      );
    });

    it('should use explicit scheduleId when provided', async () => {
      mockPrisma.bus.findUnique.mockResolvedValue({ id: BUS_ID });
      mockPrisma.schedule.findFirst.mockResolvedValue({ id: 'other-schedule' });
      mockPrisma.busTracking.upsert.mockResolvedValue(
        makeTrackingRecord({ scheduleId: 'explicit-schedule' }),
      );

      const result = await service.updatePosition(
        DRIVER_ID,
        makeUpdateInput({ scheduleId: 'explicit-schedule' }),
      );

      expect(result.scheduleId).toBe('explicit-schedule');
      expect(mockPrisma.busTracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ scheduleId: 'explicit-schedule' }),
        }),
      );
    });

    it('should throw 404 when bus does not exist', async () => {
      mockPrisma.bus.findUnique.mockResolvedValue(null);

      await expect(service.updatePosition(DRIVER_ID, makeUpdateInput())).rejects.toThrow(AppError);
      await expect(service.updatePosition(DRIVER_ID, makeUpdateInput())).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw 403 when driver is not assigned to bus', async () => {
      mockPrisma.bus.findUnique.mockResolvedValue({ id: BUS_ID });
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      await expect(service.updatePosition(DRIVER_ID, makeUpdateInput())).rejects.toThrow(AppError);
      await expect(service.updatePosition(DRIVER_ID, makeUpdateInput())).rejects.toMatchObject({
        statusCode: 403,
        code: ErrorCodes.FORBIDDEN,
      });
    });

    it('should handle null tripDate when not provided', async () => {
      mockPrisma.bus.findUnique.mockResolvedValue({ id: BUS_ID });
      mockPrisma.schedule.findFirst.mockResolvedValue({ id: SCHEDULE_ID });
      mockPrisma.busTracking.upsert.mockResolvedValue(makeTrackingRecord({ tripDate: null }));

      const input = makeUpdateInput();
      delete (input as Record<string, unknown>).tripDate;

      const result = await service.updatePosition(DRIVER_ID, input);

      expect(result.tripDate).toBeNull();
      expect(mockPrisma.busTracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ tripDate: null }),
          update: expect.objectContaining({ tripDate: null }),
        }),
      );
    });

    it('should verify driver assignment query uses correct filters', async () => {
      mockPrisma.bus.findUnique.mockResolvedValue({ id: BUS_ID });
      mockPrisma.schedule.findFirst.mockResolvedValue({ id: SCHEDULE_ID });
      mockPrisma.busTracking.upsert.mockResolvedValue(makeTrackingRecord());

      await service.updatePosition(DRIVER_ID, makeUpdateInput());

      expect(mockPrisma.schedule.findFirst).toHaveBeenCalledWith({
        where: {
          busId: BUS_ID,
          driverId: DRIVER_ID,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    });
  });

  describe('getByBusId', () => {
    it('should return tracking data when record exists', async () => {
      const record = makeTrackingRecord();
      mockPrisma.busTracking.findUnique.mockResolvedValue(record);

      const result = await service.getByBusId(BUS_ID);

      expect(result).toEqual({
        id: TRACKING_ID,
        busId: BUS_ID,
        lat: 44.4268,
        lng: 26.1025,
        speed: 60,
        heading: 90,
        scheduleId: SCHEDULE_ID,
        currentStopIndex: 2,
        isActive: true,
        tripDate: new Date('2026-03-25'),
        updatedAt: new Date('2026-03-25T10:00:00Z'),
      });

      expect(mockPrisma.busTracking.findUnique).toHaveBeenCalledWith({
        where: { busId: BUS_ID },
      });
    });

    it('should return null when no tracking record exists', async () => {
      mockPrisma.busTracking.findUnique.mockResolvedValue(null);

      const result = await service.getByBusId(BUS_ID);

      expect(result).toBeNull();
    });
  });

  describe('getActiveByProvider', () => {
    it('should return only active tracking records for provider buses', async () => {
      const records = [
        makeTrackingRecord({ id: 'track-1', busId: 'bus-1' }),
        makeTrackingRecord({ id: 'track-2', busId: 'bus-2' }),
      ];
      mockPrisma.busTracking.findMany.mockResolvedValue(records);

      const result = await service.getActiveByProvider(PROVIDER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('track-1');
      expect(result[1].id).toBe('track-2');

      expect(mockPrisma.busTracking.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          bus: { providerId: PROVIDER_ID },
        },
      });
    });

    it('should return empty array when no active tracking exists', async () => {
      mockPrisma.busTracking.findMany.mockResolvedValue([]);

      const result = await service.getActiveByProvider(PROVIDER_ID);

      expect(result).toEqual([]);
    });
  });
});
