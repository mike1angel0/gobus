import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StationService } from './station.service.js';
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
    station: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stop: {
      updateMany: vi.fn(),
    },
    stopTime: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  } as unknown as Parameters<
    typeof StationService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0];
}

const STATION_ID = 'station-1';
const SOURCE_ID = 'station-src';
const TARGET_ID = 'station-tgt';

function makeStation(overrides: Record<string, unknown> = {}) {
  return {
    id: STATION_ID,
    name: 'Autogara Nord',
    cityName: 'București',
    type: 'HUB',
    address: 'Bd. Dinicu Golescu 1',
    lat: 44.45,
    lng: 26.07,
    facilities: ['WIFI', 'PARKING'],
    phone: '+40 21 123 4567',
    email: 'contact@autogara.ro',
    platformCount: 12,
    isActive: true,
    createdBy: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

describe('StationService', () => {
  let service: StationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new StationService(prisma as never);
  });

  // ─── listStations ────────────────────────────────────────────

  describe('listStations', () => {
    it('should return paginated stations', async () => {
      const stations = [makeStation(), makeStation({ id: 'station-2', name: 'Gara de Sud' })];
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(stations);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.listStations({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(STATION_ID);
      expect(result.data[0].name).toBe('Autogara Nord');
      expect(result.data[0].type).toBe('HUB');
      expect(result.data[0].facilities).toEqual(['WIFI', 'PARKING']);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('should apply type filter', async () => {
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listStations({ page: 1, pageSize: 20, type: 'STOP' });

      expect(prisma.station.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'STOP' }),
        }),
      );
    });

    it('should apply city filter with case-insensitive partial match', async () => {
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listStations({ page: 1, pageSize: 20, city: 'bucure' });

      expect(prisma.station.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cityName: { contains: 'bucure', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should apply isActive filter', async () => {
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listStations({ page: 1, pageSize: 20, isActive: true });

      expect(prisma.station.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should apply search filter on name and address', async () => {
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.listStations({ page: 1, pageSize: 20, search: 'nord' });

      expect(prisma.station.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'nord', mode: 'insensitive' } },
              { address: { contains: 'nord', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should compute correct pagination for page 2', async () => {
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      const result = await service.listStations({ page: 2, pageSize: 10 });

      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      });
      expect(prisma.station.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ─── getById ─────────────────────────────────────────────────

  describe('getById', () => {
    it('should return station when found', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeStation());

      const result = await service.getById(STATION_ID);

      expect(result.id).toBe(STATION_ID);
      expect(result.name).toBe('Autogara Nord');
      expect(result.cityName).toBe('București');
    });

    it('should throw RESOURCE_NOT_FOUND when station does not exist', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(AppError);
      await expect(service.getById('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });
  });

  // ─── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('should create a station with all fields', async () => {
      const created = makeStation();
      (prisma.station.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

      const result = await service.create(
        {
          name: 'Autogara Nord',
          cityName: 'București',
          type: 'HUB',
          address: 'Bd. Dinicu Golescu 1',
          lat: 44.45,
          lng: 26.07,
          facilities: ['WIFI', 'PARKING'],
          phone: '+40 21 123 4567',
          email: 'contact@autogara.ro',
          platformCount: 12,
        },
        'admin',
      );

      expect(result.id).toBe(STATION_ID);
      expect(result.name).toBe('Autogara Nord');
      expect(prisma.station.create).toHaveBeenCalledWith({
        data: {
          name: 'Autogara Nord',
          cityName: 'București',
          type: 'HUB',
          address: 'Bd. Dinicu Golescu 1',
          lat: 44.45,
          lng: 26.07,
          facilities: ['WIFI', 'PARKING'],
          phone: '+40 21 123 4567',
          email: 'contact@autogara.ro',
          platformCount: 12,
          createdBy: 'admin',
        },
      });
    });

    it('should default optional fields to null when not provided', async () => {
      const created = makeStation({ phone: null, email: null, platformCount: null });
      (prisma.station.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

      await service.create(
        {
          name: 'Test Stop',
          cityName: 'Cluj',
          type: 'STOP',
          address: 'Str. Test 1',
          lat: 46.77,
          lng: 23.59,
        },
        'provider-1',
      );

      expect(prisma.station.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phone: null,
          email: null,
          platformCount: null,
          facilities: [],
        }),
      });
    });
  });

  // ─── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('should update station when found', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: STATION_ID });
      const updated = makeStation({ name: 'Autogara Centrală' });
      (prisma.station.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update(STATION_ID, { name: 'Autogara Centrală' });

      expect(result.name).toBe('Autogara Centrală');
      expect(prisma.station.update).toHaveBeenCalledWith({
        where: { id: STATION_ID },
        data: { name: 'Autogara Centrală' },
      });
    });

    it('should throw RESOURCE_NOT_FOUND when station does not exist', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });
  });

  // ─── deactivate ──────────────────────────────────────────────

  describe('deactivate', () => {
    it('should deactivate station when not referenced by active schedules', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: STATION_ID,
        isActive: true,
      });
      (prisma.stopTime.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.station.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.deactivate(STATION_ID);

      expect(prisma.station.update).toHaveBeenCalledWith({
        where: { id: STATION_ID },
        data: { isActive: false },
      });
    });

    it('should throw RESOURCE_NOT_FOUND when station does not exist', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.deactivate('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw STATION_IN_USE when station is referenced by active schedules', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: STATION_ID,
        isActive: true,
      });
      (prisma.stopTime.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      await expect(service.deactivate(STATION_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: ErrorCodes.STATION_IN_USE,
      });
    });
  });

  // ─── merge ───────────────────────────────────────────────────

  describe('merge', () => {
    it('should merge source into target and deactivate source', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: SOURCE_ID })
        .mockResolvedValueOnce({ id: TARGET_ID });
      const targetStation = makeStation({ id: TARGET_ID, name: 'Target Station' });
      (prisma.station.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(targetStation);

      const result = await service.merge(SOURCE_ID, TARGET_ID);

      expect(result.id).toBe(TARGET_ID);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.stop.updateMany).toHaveBeenCalledWith({
        where: { stationId: SOURCE_ID },
        data: { stationId: TARGET_ID },
      });
      expect(prisma.stopTime.updateMany).toHaveBeenCalledWith({
        where: { stationId: SOURCE_ID },
        data: { stationId: TARGET_ID },
      });
      expect(prisma.station.update).toHaveBeenCalledWith({
        where: { id: SOURCE_ID },
        data: { isActive: false },
      });
    });

    it('should throw RESOURCE_NOT_FOUND when source does not exist', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: TARGET_ID });

      await expect(service.merge('nonexistent', TARGET_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Source station not found',
      });
    });

    it('should throw RESOURCE_NOT_FOUND when target does not exist', async () => {
      (prisma.station.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: SOURCE_ID })
        .mockResolvedValueOnce(null);

      await expect(service.merge(SOURCE_ID, 'nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Target station not found',
      });
    });
  });

  // ─── searchActive ────────────────────────────────────────────

  describe('searchActive', () => {
    it('should search active stations with query', async () => {
      const stations = [makeStation()];
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(stations);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.searchActive({ search: 'nord', page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(1);
      expect(prisma.station.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: [
              { name: { contains: 'nord', mode: 'insensitive' } },
              { cityName: { contains: 'nord', mode: 'insensitive' } },
              { address: { contains: 'nord', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should return all active stations when no search query is provided', async () => {
      (prisma.station.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.station.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.searchActive({ page: 1, pageSize: 10 });

      expect(prisma.station.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });
  });
});
