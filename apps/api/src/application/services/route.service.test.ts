import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouteService } from './route.service.js';
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
    route: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    schedule: {
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        route: {
          create: vi.fn(),
        },
      }),
    ),
  } as unknown as Parameters<
    typeof RouteService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0];
}

const PROVIDER_ID = 'provider-1';
const OTHER_PROVIDER_ID = 'provider-2';
const ROUTE_ID = 'route-1';

function makeRoute(overrides: Record<string, unknown> = {}) {
  return {
    id: ROUTE_ID,
    name: 'Bucharest - Cluj',
    providerId: PROVIDER_ID,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeStop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stop-1',
    name: 'Bucharest',
    lat: 44.4268,
    lng: 26.1025,
    orderIndex: 0,
    routeId: ROUTE_ID,
    ...overrides,
  };
}

describe('RouteService', () => {
  let service: RouteService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new RouteService(prisma as never);
  });

  // ─── listByProvider ────────────────────────────────────────────

  describe('listByProvider', () => {
    it('should return paginated routes for the provider', async () => {
      const routes = [makeRoute(), makeRoute({ id: 'route-2', name: 'Iasi - Timisoara' })];
      (prisma.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(routes);
      (prisma.route.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: ROUTE_ID,
        name: 'Bucharest - Cluj',
        providerId: PROVIDER_ID,
        createdAt: new Date('2024-01-01'),
      });
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(prisma.route.findMany).toHaveBeenCalledWith({
        where: { providerId: PROVIDER_ID },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        select: { id: true, name: true, providerId: true, createdAt: true },
      });
    });

    it('should compute correct pagination for page 2', async () => {
      (prisma.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.route.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      const result = await service.listByProvider(PROVIDER_ID, { page: 2, pageSize: 10 });

      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      });
      expect(prisma.route.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should return empty list when provider has no routes', async () => {
      (prisma.route.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.route.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ─── getById ───────────────────────────────────────────────────

  describe('getById', () => {
    it('should return route with stops when found and owned', async () => {
      const stops = [
        makeStop(),
        makeStop({ id: 'stop-2', name: 'Cluj', lat: 46.77, lng: 23.59, orderIndex: 1 }),
      ];
      const route = { ...makeRoute(), stops };
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(route);

      const result = await service.getById(ROUTE_ID, PROVIDER_ID);

      expect(result.id).toBe(ROUTE_ID);
      expect(result.name).toBe('Bucharest - Cluj');
      expect(result.stops).toHaveLength(2);
      expect(result.stops[0]).toEqual({
        id: 'stop-1',
        name: 'Bucharest',
        lat: 44.4268,
        lng: 26.1025,
        orderIndex: 0,
      });
      expect(result.stops[1]).toEqual({
        id: 'stop-2',
        name: 'Cluj',
        lat: 46.77,
        lng: 23.59,
        orderIndex: 1,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when route does not exist', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getById('nonexistent', PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.getById('nonexistent', PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when route belongs to another provider', async () => {
      const route = { ...makeRoute({ providerId: OTHER_PROVIDER_ID }), stops: [] };
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(route);

      await expect(service.getById(ROUTE_ID, PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.getById(ROUTE_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Route not found',
      });
    });
  });

  // ─── create ────────────────────────────────────────────────────

  describe('create', () => {
    it('should create route with stops in a transaction', async () => {
      const createdRoute = {
        ...makeRoute(),
        stops: [
          makeStop(),
          makeStop({ id: 'stop-2', name: 'Cluj', lat: 46.77, lng: 23.59, orderIndex: 1 }),
        ],
      };

      const mockTxCreate = vi.fn().mockResolvedValue(createdRoute);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) => fn({ route: { create: mockTxCreate } }),
      );

      const result = await service.create(PROVIDER_ID, {
        name: 'Bucharest - Cluj',
        stops: [
          { name: 'Bucharest', lat: 44.4268, lng: 26.1025, orderIndex: 0 },
          { name: 'Cluj', lat: 46.77, lng: 23.59, orderIndex: 1 },
        ],
      });

      expect(result.id).toBe(ROUTE_ID);
      expect(result.name).toBe('Bucharest - Cluj');
      expect(result.stops).toHaveLength(2);
      expect(mockTxCreate).toHaveBeenCalledWith({
        data: {
          name: 'Bucharest - Cluj',
          providerId: PROVIDER_ID,
          stops: {
            create: [
              { name: 'Bucharest', lat: 44.4268, lng: 26.1025, orderIndex: 0 },
              { name: 'Cluj', lat: 46.77, lng: 23.59, orderIndex: 1 },
            ],
          },
        },
        include: { stops: { orderBy: { orderIndex: 'asc' } } },
      });
    });
  });

  // ─── delete ────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete route when owned and no active schedules', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.route.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.delete(ROUTE_ID, PROVIDER_ID);

      expect(prisma.route.delete).toHaveBeenCalledWith({ where: { id: ROUTE_ID } });
    });

    it('should throw RESOURCE_NOT_FOUND when route does not exist', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.delete('nonexistent', PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.delete('nonexistent', PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when route belongs to another provider', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
      });

      await expect(service.delete(ROUTE_ID, PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.delete(ROUTE_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw CONFLICT when route has active schedules', async () => {
      (prisma.route.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      await expect(service.delete(ROUTE_ID, PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.delete(ROUTE_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: ErrorCodes.CONFLICT,
        detail: 'Cannot delete route with active schedules',
      });
    });
  });
});
