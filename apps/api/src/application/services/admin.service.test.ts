import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminService } from './admin.service.js';
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

const BUS_ID = 'bus-1';
const SEAT_ID = 'seat-1';
const PROVIDER_ID = 'provider-1';

function makeBusRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BUS_ID,
    licensePlate: 'B-123-ABC',
    model: 'Mercedes Tourismo',
    capacity: 50,
    rows: 13,
    columns: 4,
    providerId: PROVIDER_ID,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

function makeSeatRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: SEAT_ID,
    row: 1,
    column: 1,
    label: '1A',
    type: 'STANDARD',
    price: 0,
    isEnabled: true,
    busId: BUS_ID,
    ...overrides,
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let mockPrisma: {
    bus: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
    seat: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    mockPrisma = {
      bus: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      seat: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new AdminService(mockPrisma as never);
  });

  describe('listAllBuses', () => {
    it('returns paginated buses across all providers', async () => {
      const bus1 = makeBusRecord();
      const bus2 = makeBusRecord({ id: 'bus-2', providerId: 'provider-2', licensePlate: 'CJ-456' });
      mockPrisma.bus.findMany.mockResolvedValue([bus1, bus2]);
      mockPrisma.bus.count.mockResolvedValue(2);

      const result = await service.listAllBuses({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: BUS_ID,
        licensePlate: 'B-123-ABC',
        model: 'Mercedes Tourismo',
        capacity: 50,
        rows: 13,
        columns: 4,
        providerId: PROVIDER_ID,
        createdAt: new Date('2026-01-15T10:00:00Z'),
      });
      expect(result.meta).toEqual({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
    });

    it('returns empty list when no buses exist', async () => {
      mockPrisma.bus.findMany.mockResolvedValue([]);
      mockPrisma.bus.count.mockResolvedValue(0);

      const result = await service.listAllBuses({ page: 1, pageSize: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
    });

    it('filters by providerId when provided', async () => {
      mockPrisma.bus.findMany.mockResolvedValue([makeBusRecord()]);
      mockPrisma.bus.count.mockResolvedValue(1);

      await service.listAllBuses({ page: 1, pageSize: 20, providerId: PROVIDER_ID });

      expect(mockPrisma.bus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { providerId: PROVIDER_ID } }),
      );
      expect(mockPrisma.bus.count).toHaveBeenCalledWith({ where: { providerId: PROVIDER_ID } });
    });

    it('passes no where filter when providerId is omitted', async () => {
      mockPrisma.bus.findMany.mockResolvedValue([]);
      mockPrisma.bus.count.mockResolvedValue(0);

      await service.listAllBuses({ page: 1, pageSize: 20 });

      expect(mockPrisma.bus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(mockPrisma.bus.count).toHaveBeenCalledWith({ where: {} });
    });

    it('applies correct pagination skip/take', async () => {
      mockPrisma.bus.findMany.mockResolvedValue([]);
      mockPrisma.bus.count.mockResolvedValue(50);

      const result = await service.listAllBuses({ page: 3, pageSize: 10 });

      expect(mockPrisma.bus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 50, page: 3, pageSize: 10, totalPages: 5 });
    });

    it('orders buses by createdAt descending', async () => {
      mockPrisma.bus.findMany.mockResolvedValue([]);
      mockPrisma.bus.count.mockResolvedValue(0);

      await service.listAllBuses({ page: 1, pageSize: 20 });

      expect(mockPrisma.bus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('toggleSeat', () => {
    it('disables an enabled seat', async () => {
      const seat = makeSeatRecord({ isEnabled: true });
      mockPrisma.seat.findUnique.mockResolvedValue(seat);
      mockPrisma.seat.update.mockResolvedValue({ ...seat, isEnabled: false });

      const result = await service.toggleSeat(SEAT_ID, false);

      expect(result.isEnabled).toBe(false);
      expect(mockPrisma.seat.update).toHaveBeenCalledWith({
        where: { id: SEAT_ID },
        data: { isEnabled: false },
      });
    });

    it('enables a disabled seat', async () => {
      const seat = makeSeatRecord({ isEnabled: false });
      mockPrisma.seat.findUnique.mockResolvedValue(seat);
      mockPrisma.seat.update.mockResolvedValue({ ...seat, isEnabled: true });

      const result = await service.toggleSeat(SEAT_ID, true);

      expect(result.isEnabled).toBe(true);
      expect(mockPrisma.seat.update).toHaveBeenCalledWith({
        where: { id: SEAT_ID },
        data: { isEnabled: true },
      });
    });

    it('returns correct seat entity shape', async () => {
      const seat = makeSeatRecord();
      mockPrisma.seat.findUnique.mockResolvedValue(seat);
      mockPrisma.seat.update.mockResolvedValue(seat);

      const result = await service.toggleSeat(SEAT_ID, true);

      expect(result).toEqual({
        id: SEAT_ID,
        row: 1,
        column: 1,
        label: '1A',
        type: 'STANDARD',
        price: 0,
        isEnabled: true,
      });
    });

    it('throws RESOURCE_NOT_FOUND when seat does not exist', async () => {
      mockPrisma.seat.findUnique.mockResolvedValue(null);

      await expect(service.toggleSeat('nonexistent', true)).rejects.toThrow(AppError);
      await expect(service.toggleSeat('nonexistent', true)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('does not call update when seat is not found', async () => {
      mockPrisma.seat.findUnique.mockResolvedValue(null);

      await expect(service.toggleSeat('nonexistent', true)).rejects.toThrow();

      expect(mockPrisma.seat.update).not.toHaveBeenCalled();
    });
  });
});
