import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusService } from './bus.service.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { BUS_TEMPLATES } from '@/domain/buses/bus-templates.js';

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
    bus: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    schedule: {
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        bus: {
          create: vi.fn(),
        },
      }),
    ),
  } as unknown as Parameters<
    typeof BusService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0];
}

const PROVIDER_ID = 'provider-1';
const OTHER_PROVIDER_ID = 'provider-2';
const BUS_ID = 'bus-1';

function makeBus(overrides: Record<string, unknown> = {}) {
  return {
    id: BUS_ID,
    licensePlate: 'B-123-ABC',
    model: 'Mercedes Tourismo',
    capacity: 52,
    rows: 13,
    columns: 4,
    providerId: PROVIDER_ID,
    provider: { name: 'Test Provider' },
    createdAt: new Date('2024-01-01'),
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
    busId: BUS_ID,
    ...overrides,
  };
}

describe('BusService', () => {
  let service: BusService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new BusService(prisma as never);
  });

  // ─── listByProvider ────────────────────────────────────────────

  describe('listByProvider', () => {
    it('should return paginated buses for the provider', async () => {
      const buses = [makeBus(), makeBus({ id: 'bus-2', licensePlate: 'B-456-DEF' })];
      (prisma.bus.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(buses);
      (prisma.bus.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: BUS_ID,
        licensePlate: 'B-123-ABC',
        model: 'Mercedes Tourismo',
        capacity: 52,
        rows: 13,
        columns: 4,
        providerId: PROVIDER_ID,
        providerName: 'Test Provider',
        createdAt: new Date('2024-01-01'),
      });
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(prisma.bus.findMany).toHaveBeenCalledWith({
        where: { providerId: PROVIDER_ID },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        select: {
          id: true,
          licensePlate: true,
          model: true,
          capacity: true,
          rows: true,
          columns: true,
          providerId: true,
          provider: { select: { name: true } },
          createdAt: true,
        },
      });
    });

    it('should compute correct pagination for page 2', async () => {
      (prisma.bus.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.bus.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      const result = await service.listByProvider(PROVIDER_ID, { page: 2, pageSize: 10 });

      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      });
      expect(prisma.bus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should return empty list when provider has no buses', async () => {
      (prisma.bus.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.bus.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ─── getById ───────────────────────────────────────────────────

  describe('getById', () => {
    it('should return bus with seats when found and owned', async () => {
      const seats = [makeSeat(), makeSeat({ id: 'seat-2', row: 1, column: 2, label: '1B' })];
      const bus = { ...makeBus(), seats };
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bus);

      const result = await service.getById(BUS_ID, PROVIDER_ID);

      expect(result.id).toBe(BUS_ID);
      expect(result.licensePlate).toBe('B-123-ABC');
      expect(result.seats).toHaveLength(2);
      expect(result.seats[0]).toEqual({
        id: 'seat-1',
        row: 1,
        column: 1,
        label: '1A',
        type: 'STANDARD',
        price: 0,
        isEnabled: true,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when bus does not exist', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getById('nonexistent', PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.getById('nonexistent', PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when bus belongs to another provider', async () => {
      const bus = { ...makeBus({ providerId: OTHER_PROVIDER_ID }), seats: [] };
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bus);

      await expect(service.getById(BUS_ID, PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.getById(BUS_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        detail: 'Bus not found',
      });
    });
  });

  // ─── create ────────────────────────────────────────────────────

  describe('create', () => {
    it('should create bus with seats in a transaction', async () => {
      const seats = [makeSeat(), makeSeat({ id: 'seat-2', row: 1, column: 2, label: '1B' })];
      const createdBus = { ...makeBus(), seats };

      const mockTxCreate = vi.fn().mockResolvedValue(createdBus);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) => fn({ bus: { create: mockTxCreate } }),
      );
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.create(PROVIDER_ID, {
        licensePlate: 'B-123-ABC',
        model: 'Mercedes Tourismo',
        capacity: 52,
        rows: 13,
        columns: 4,
        seats: [
          { row: 1, column: 1, label: '1A', type: 'STANDARD', price: 0 },
          { row: 1, column: 2, label: '1B', type: 'STANDARD', price: 0 },
        ],
      });

      expect(result.id).toBe(BUS_ID);
      expect(result.licensePlate).toBe('B-123-ABC');
      expect(result.seats).toHaveLength(2);
      expect(mockTxCreate).toHaveBeenCalledWith({
        data: {
          licensePlate: 'B-123-ABC',
          model: 'Mercedes Tourismo',
          capacity: 52,
          rows: 13,
          columns: 4,
          providerId: PROVIDER_ID,
          seats: {
            create: [
              { row: 1, column: 1, label: '1A', type: 'STANDARD', price: 0, isEnabled: true },
              { row: 1, column: 2, label: '1B', type: 'STANDARD', price: 0, isEnabled: true },
            ],
          },
        },
        include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] }, provider: { select: { name: true } } },
      });
    });

    it('should throw CONFLICT when license plate already exists', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'other-bus' });

      await expect(
        service.create(PROVIDER_ID, {
          licensePlate: 'B-123-ABC',
          model: 'Test',
          capacity: 10,
          rows: 5,
          columns: 2,
          seats: [],
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: ErrorCodes.CONFLICT,
        detail: 'License plate already exists',
      });
    });

    it('should set isEnabled to false for BLOCKED seats', async () => {
      const createdBus = {
        ...makeBus(),
        seats: [makeSeat({ type: 'BLOCKED', isEnabled: false })],
      };

      const mockTxCreate = vi.fn().mockResolvedValue(createdBus);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) => fn({ bus: { create: mockTxCreate } }),
      );
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await service.create(PROVIDER_ID, {
        licensePlate: 'B-999-XYZ',
        model: 'Test',
        capacity: 1,
        rows: 1,
        columns: 1,
        seats: [{ row: 1, column: 1, label: '1A', type: 'BLOCKED' }],
      });

      expect(mockTxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            seats: {
              create: [
                { row: 1, column: 1, label: '1A', type: 'BLOCKED', price: 0, isEnabled: false },
              ],
            },
          }),
        }),
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────

  describe('update', () => {
    it('should update bus metadata when owned', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      const updatedBus = { ...makeBus({ model: 'Setra S515' }), seats: [makeSeat()] };
      (prisma.bus.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedBus);

      const result = await service.update(BUS_ID, PROVIDER_ID, { model: 'Setra S515' });

      expect(result.model).toBe('Setra S515');
      expect(prisma.bus.update).toHaveBeenCalledWith({
        where: { id: BUS_ID },
        data: { model: 'Setra S515' },
        include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] }, provider: { select: { name: true } } },
      });
    });

    it('should update bus capacity when provided', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      const updatedBus = { ...makeBus({ capacity: 60 }), seats: [makeSeat()] };
      (prisma.bus.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedBus);

      const result = await service.update(BUS_ID, PROVIDER_ID, { capacity: 60 });

      expect(result.capacity).toBe(60);
      expect(prisma.bus.update).toHaveBeenCalledWith({
        where: { id: BUS_ID },
        data: { capacity: 60 },
        include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] }, provider: { select: { name: true } } },
      });
    });

    it('should update multiple fields at once', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ providerId: PROVIDER_ID })
        .mockResolvedValueOnce(null); // license plate uniqueness check
      const updatedBus = {
        ...makeBus({ licensePlate: 'X-999-YYY', model: 'Neoplan', capacity: 56 }),
        seats: [makeSeat()],
      };
      (prisma.bus.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedBus);

      const result = await service.update(BUS_ID, PROVIDER_ID, {
        licensePlate: 'X-999-YYY',
        model: 'Neoplan',
        capacity: 56,
      });

      expect(result.licensePlate).toBe('X-999-YYY');
      expect(result.model).toBe('Neoplan');
      expect(result.capacity).toBe(56);
      expect(prisma.bus.update).toHaveBeenCalledWith({
        where: { id: BUS_ID },
        data: { licensePlate: 'X-999-YYY', model: 'Neoplan', capacity: 56 },
        include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] }, provider: { select: { name: true } } },
      });
    });

    it('should throw RESOURCE_NOT_FOUND when bus does not exist', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', PROVIDER_ID, { model: 'X' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when bus belongs to another provider', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
      });

      await expect(service.update(BUS_ID, PROVIDER_ID, { model: 'X' })).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw CONFLICT when updating to an existing license plate', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ providerId: PROVIDER_ID })
        .mockResolvedValueOnce({ id: 'other-bus' });

      await expect(
        service.update(BUS_ID, PROVIDER_ID, { licensePlate: 'TAKEN-LP' }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: ErrorCodes.CONFLICT,
        detail: 'License plate already exists',
      });
    });

    it('should allow updating to the same license plate on the same bus', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ providerId: PROVIDER_ID })
        .mockResolvedValueOnce({ id: BUS_ID });
      const updatedBus = { ...makeBus(), seats: [makeSeat()] };
      (prisma.bus.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedBus);

      const result = await service.update(BUS_ID, PROVIDER_ID, { licensePlate: 'B-123-ABC' });

      expect(result.id).toBe(BUS_ID);
    });

    it('should replace seat layout in a transaction when seats are provided', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });

      const newSeats = [
        makeSeat({ id: 'new-seat-1', row: 1, column: 1, label: '1A' }),
        makeSeat({ id: 'new-seat-2', row: 1, column: 2, label: '1B' }),
      ];
      const updatedBus = { ...makeBus({ rows: 1, columns: 2, capacity: 2 }), seats: newSeats };

      const mockTxDeleteMany = vi.fn().mockResolvedValue({ count: 4 });
      const mockTxUpdate = vi.fn().mockResolvedValue(updatedBus);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({ seat: { deleteMany: mockTxDeleteMany }, bus: { update: mockTxUpdate } }),
      );

      const result = await service.update(BUS_ID, PROVIDER_ID, {
        model: 'Updated Model',
        rows: 1,
        columns: 2,
        capacity: 2,
        seats: [
          { row: 1, column: 1, label: '1A', type: 'STANDARD', price: 10 },
          { row: 1, column: 2, label: '1B', type: 'STANDARD', price: 10 },
        ],
      });

      expect(result.id).toBe(BUS_ID);
      expect(result.seats).toHaveLength(2);
      expect(result.seats[0]).toEqual({
        id: 'new-seat-1',
        row: 1,
        column: 1,
        label: '1A',
        type: 'STANDARD',
        price: 0,
        isEnabled: true,
      });
      expect(mockTxDeleteMany).toHaveBeenCalledWith({ where: { busId: BUS_ID } });
      expect(mockTxUpdate).toHaveBeenCalledWith({
        where: { id: BUS_ID },
        data: {
          model: 'Updated Model',
          rows: 1,
          columns: 2,
          capacity: 2,
          seats: {
            create: [
              { row: 1, column: 1, label: '1A', type: 'STANDARD', price: 10, isEnabled: true },
              { row: 1, column: 2, label: '1B', type: 'STANDARD', price: 10, isEnabled: true },
            ],
          },
        },
        include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] }, provider: { select: { name: true } } },
      });
      // Verify direct prisma.bus.update was NOT called (transaction path used instead)
      expect(prisma.bus.update).not.toHaveBeenCalled();
    });

    it('should default seat price to 0 and disable BLOCKED seats when updating with seats', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });

      const newSeats = [
        makeSeat({ id: 'seat-a', row: 1, column: 1, label: '1A', type: 'STANDARD', price: 5 }),
        makeSeat({
          id: 'seat-b',
          row: 1,
          column: 2,
          label: '1B',
          type: 'BLOCKED',
          price: 0,
          isEnabled: false,
        }),
      ];
      const updatedBus = { ...makeBus(), seats: newSeats };

      const mockTxDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
      const mockTxUpdate = vi.fn().mockResolvedValue(updatedBus);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) =>
          fn({ seat: { deleteMany: mockTxDeleteMany }, bus: { update: mockTxUpdate } }),
      );

      const result = await service.update(BUS_ID, PROVIDER_ID, {
        seats: [
          { row: 1, column: 1, label: '1A', type: 'STANDARD' },
          { row: 1, column: 2, label: '1B', type: 'BLOCKED' },
        ],
      });

      expect(result.seats).toHaveLength(2);
      expect(result.seats[1]).toEqual({
        id: 'seat-b',
        row: 1,
        column: 2,
        label: '1B',
        type: 'BLOCKED',
        price: 0,
        isEnabled: false,
      });
      expect(mockTxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            seats: {
              create: [
                { row: 1, column: 1, label: '1A', type: 'STANDARD', price: 0, isEnabled: true },
                { row: 1, column: 2, label: '1B', type: 'BLOCKED', price: 0, isEnabled: false },
              ],
            },
          }),
        }),
      );
    });
  });

  // ─── delete ────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete bus when owned and no active schedules', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.bus.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.delete(BUS_ID, PROVIDER_ID);

      expect(prisma.bus.delete).toHaveBeenCalledWith({ where: { id: BUS_ID } });
    });

    it('should throw RESOURCE_NOT_FOUND when bus does not exist', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.delete('nonexistent', PROVIDER_ID)).rejects.toThrow(AppError);
      await expect(service.delete('nonexistent', PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw RESOURCE_NOT_FOUND when bus belongs to another provider', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
      });

      await expect(service.delete(BUS_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw CONFLICT when bus has active schedules', async () => {
      (prisma.bus.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
      });
      (prisma.schedule.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await expect(service.delete(BUS_ID, PROVIDER_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: ErrorCodes.CONFLICT,
        detail: 'Cannot delete bus with active schedules',
      });
    });
  });

  // ─── getTemplates ──────────────────────────────────────────────

  describe('getTemplates', () => {
    it('should return all bus templates', () => {
      const templates = service.getTemplates();

      expect(templates).toHaveLength(BUS_TEMPLATES.length);
      expect(templates[0].id).toBe('coach-mercedes-tourismo');
      expect(templates[0].name).toBe('Mercedes Tourismo 13x4');
      expect(templates[0].rows).toBe(13);
      expect(templates[0].columns).toBe(4);
    });

    it('should return a copy of templates (not the original array)', () => {
      const templates1 = service.getTemplates();
      const templates2 = service.getTemplates();

      expect(templates1).not.toBe(templates2);
      expect(templates1).toEqual(templates2);
    });
  });

  // ─── getTemplateById ───────────────────────────────────────────

  describe('getTemplateById', () => {
    it('should return template when found', () => {
      const template = service.getTemplateById('coach-mercedes-tourismo');

      expect(template).toBeDefined();
      expect(template!.id).toBe('coach-mercedes-tourismo');
      expect(template!.name).toBe('Mercedes Tourismo 13x4');
    });

    it('should return undefined when template not found', () => {
      const template = service.getTemplateById('nonexistent');

      expect(template).toBeUndefined();
    });
  });
});
