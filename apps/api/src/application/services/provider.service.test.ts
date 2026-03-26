import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderService } from './provider.service.js';
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

function createMockTx() {
  return {
    route: { findMany: vi.fn() },
    booking: { aggregate: vi.fn(), groupBy: vi.fn() },
    schedule: { findMany: vi.fn() },
  };
}

function createMockPrisma() {
  const tx = createMockTx();
  return {
    provider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    _tx: tx,
  } as unknown as Parameters<
    typeof ProviderService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0] & { _tx: ReturnType<typeof createMockTx> };
}

function makeProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: 'provider-1',
    name: 'Test Transport Co',
    logo: null,
    contactEmail: 'contact@test.com',
    contactPhone: '+40700000000',
    status: 'APPROVED' as const,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('ProviderService', () => {
  let service: ProviderService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ProviderService(prisma as never);
  });

  // ─── getById ──────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return the provider entity when found', async () => {
      const provider = makeProvider();
      (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(provider);

      const result = await service.getById('provider-1');

      expect(result).toEqual({
        id: 'provider-1',
        name: 'Test Transport Co',
        logo: null,
        contactEmail: 'contact@test.com',
        contactPhone: '+40700000000',
        status: 'APPROVED',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });
      expect(prisma.provider.findUnique).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
      });
    });

    it('should throw RESOURCE_NOT_FOUND when provider does not exist', async () => {
      (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(AppError);
      await expect(service.getById('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });
  });

  // ─── getByUserId ──────────────────────────────────────────────────

  describe('getByUserId', () => {
    it('should return the provider for a user with a providerId', async () => {
      const provider = makeProvider();
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        provider,
      });

      const result = await service.getByUserId('user-1');

      expect(result.id).toBe('provider-1');
      expect(result.name).toBe('Test Transport Co');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { provider: true },
      });
    });

    it('should throw RESOURCE_NOT_FOUND when user does not exist', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getByUserId('nonexistent')).rejects.toThrow(AppError);
      await expect(service.getByUserId('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when user has no providerId', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        provider: null,
      });

      await expect(service.getByUserId('user-1')).rejects.toThrow(AppError);
      await expect(service.getByUserId('user-1')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'No provider associated with this user',
      });
    });
  });

  // ─── updateProfile ────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('should update and return the updated provider entity', async () => {
      const existing = makeProvider();
      const updated = makeProvider({ name: 'New Name', updatedAt: new Date('2024-06-01') });
      (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.provider.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.updateProfile('provider-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
        data: { name: 'New Name' },
      });
    });

    it('should update multiple fields at once', async () => {
      const existing = makeProvider();
      const updated = makeProvider({
        name: 'Updated Co',
        logo: 'https://example.com/logo.png',
        contactEmail: 'new@example.com',
        contactPhone: '+40711111111',
      });
      (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.provider.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.updateProfile('provider-1', {
        name: 'Updated Co',
        logo: 'https://example.com/logo.png',
        contactEmail: 'new@example.com',
        contactPhone: '+40711111111',
      });

      expect(result.name).toBe('Updated Co');
      expect(result.logo).toBe('https://example.com/logo.png');
      expect(result.contactEmail).toBe('new@example.com');
      expect(result.contactPhone).toBe('+40711111111');
    });

    it('should allow setting nullable fields to null', async () => {
      const existing = makeProvider({ logo: 'https://example.com/old.png' });
      const updated = makeProvider({ logo: null });
      (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.provider.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.updateProfile('provider-1', { logo: null });

      expect(result.logo).toBeNull();
    });

    it('should throw RESOURCE_NOT_FOUND when provider does not exist', async () => {
      (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.updateProfile('nonexistent', { name: 'Test' })).rejects.toThrow(
        AppError,
      );
      await expect(service.updateProfile('nonexistent', { name: 'Test' })).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });
  });

  // ─── getAnalytics ────────────────────────────────────────────────

  describe('getAnalytics', () => {
    it('should return empty analytics when provider has no routes', async () => {
      const { _tx: tx } = prisma as ReturnType<typeof createMockPrisma>;
      (tx.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.getAnalytics('provider-1');

      expect(result).toEqual({
        totalBookings: 0,
        totalRevenue: 0,
        averageOccupancy: 0,
        revenueByRoute: [],
      });
    });

    it('should compute analytics with bookings, occupancy, and revenue by route', async () => {
      const { _tx: tx } = prisma as ReturnType<typeof createMockPrisma>;

      (tx.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'route-1', name: 'Route A' },
        { id: 'route-2', name: 'Route B' },
      ]);

      (tx.booking.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _count: { id: 15 },
        _sum: { totalPrice: 1500.456 },
      });

      (tx.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sched-1', routeId: 'route-1', bus: { capacity: 50 } },
        { id: 'sched-2', routeId: 'route-2', bus: { capacity: 30 } },
      ]);

      // groupBy called twice: first for revenueBySchedule (Promise.all), then for bookedCounts
      (tx.booking.groupBy as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { scheduleId: 'sched-1', _sum: { totalPrice: 1000 } },
          { scheduleId: 'sched-2', _sum: { totalPrice: 500.456 } },
        ])
        .mockResolvedValueOnce([
          { scheduleId: 'sched-1', _count: { id: 10 } },
          { scheduleId: 'sched-2', _count: { id: 5 } },
        ]);

      const result = await service.getAnalytics('provider-1');

      expect(result.totalBookings).toBe(15);
      expect(result.totalRevenue).toBe(1500.46);
      expect(result.averageOccupancy).toBe(0.19); // 15/80 = 0.1875 → 0.19
      expect(result.revenueByRoute).toEqual([
        { routeId: 'route-1', routeName: 'Route A', revenue: 1000 },
        { routeId: 'route-2', routeName: 'Route B', revenue: 500.46 },
      ]);
    });

    it('should fetch unmapped schedules for revenue when not all are active', async () => {
      const { _tx: tx } = prisma as ReturnType<typeof createMockPrisma>;

      (tx.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'route-1', name: 'Route A' },
      ]);

      (tx.booking.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _count: { id: 5 },
        _sum: { totalPrice: 250 },
      });

      // No active schedules
      (tx.schedule.findMany as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // active schedules
        .mockResolvedValueOnce([{ id: 'sched-old', routeId: 'route-1' }]); // unmapped fetch

      // groupBy for revenueBySchedule only (no bookedCounts since no active schedules)
      (tx.booking.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { scheduleId: 'sched-old', _sum: { totalPrice: 250 } },
      ]);

      const result = await service.getAnalytics('provider-1');

      expect(result.totalBookings).toBe(5);
      expect(result.totalRevenue).toBe(250);
      expect(result.averageOccupancy).toBe(0);
      expect(result.revenueByRoute).toEqual([
        { routeId: 'route-1', routeName: 'Route A', revenue: 250 },
      ]);
    });

    it('should use $transaction for consistent snapshot', async () => {
      const { _tx: tx } = prisma as ReturnType<typeof createMockPrisma>;
      (tx.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await service.getAnalytics('provider-1');

      expect(
        (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction,
      ).toHaveBeenCalledOnce();
    });

    it('should exclude routes with zero revenue from revenueByRoute', async () => {
      const { _tx: tx } = prisma as ReturnType<typeof createMockPrisma>;

      (tx.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'route-1', name: 'Route A' },
        { id: 'route-2', name: 'Route B' },
      ]);

      (tx.booking.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _count: { id: 3 },
        _sum: { totalPrice: 300 },
      });

      (tx.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sched-1', routeId: 'route-1', bus: { capacity: 40 } },
      ]);

      (tx.booking.groupBy as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { scheduleId: 'sched-1', _sum: { totalPrice: 300 } },
        ])
        .mockResolvedValueOnce([
          { scheduleId: 'sched-1', _count: { id: 3 } },
        ]);

      const result = await service.getAnalytics('provider-1');

      expect(result.revenueByRoute).toHaveLength(1);
      expect(result.revenueByRoute[0].routeId).toBe('route-1');
    });
  });
});
