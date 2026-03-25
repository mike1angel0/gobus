import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriverService } from './driver.service.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}));

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
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    schedule: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((actions: unknown[]) => Promise.all(actions)),
  } as unknown as Parameters<
    typeof DriverService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0];
}

const PROVIDER_ID = 'provider-1';
const OTHER_PROVIDER_ID = 'provider-2';
const DRIVER_ID = 'driver-1';

function makeDriver(overrides: Record<string, unknown> = {}) {
  return {
    id: DRIVER_ID,
    email: 'driver@example.com',
    name: 'John Driver',
    passwordHash: 'hashed',
    role: 'DRIVER',
    phone: '+40712345678',
    status: 'ACTIVE',
    providerId: PROVIDER_ID,
    avatarUrl: null,
    preferences: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('DriverService', () => {
  let service: DriverService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DriverService(prisma as never);
  });

  describe('listByProvider', () => {
    it('should return paginated drivers with schedule counts', async () => {
      const drivers = [
        { ...makeDriver(), _count: { driverSchedules: 3 } },
        {
          ...makeDriver({ id: 'driver-2', email: 'driver2@example.com' }),
          _count: { driverSchedules: 0 },
        },
      ];
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(drivers);
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].assignedScheduleCount).toBe(3);
      expect(result.data[1].assignedScheduleCount).toBe(0);
      expect(result.meta).toEqual({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerId: PROVIDER_ID, role: 'DRIVER' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should handle empty list', async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.listByProvider(PROVIDER_ID, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta).toEqual({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
    });

    it('should paginate correctly on page 2', async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      await service.listByProvider(PROVIDER_ID, { page: 2, pageSize: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('create', () => {
    it('should create a driver with hashed password and DRIVER role', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const created = makeDriver();
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

      const result = await service.create(PROVIDER_ID, {
        email: 'driver@example.com',
        password: 'StrongPass1',
        name: 'John Driver',
        phone: '+40712345678',
      });

      expect(result.id).toBe(DRIVER_ID);
      expect(result.email).toBe('driver@example.com');
      expect(result.role).toBe('DRIVER');
      expect(result.providerId).toBe(PROVIDER_ID);
      expect(result.assignedScheduleCount).toBe(0);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'driver@example.com',
          name: 'John Driver',
          passwordHash: 'hashed-password',
          role: 'DRIVER',
          phone: '+40712345678',
          providerId: PROVIDER_ID,
        },
      });
    });

    it('should set phone to null when not provided', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeDriver({ phone: null }),
      );

      await service.create(PROVIDER_ID, {
        email: 'driver@example.com',
        password: 'StrongPass1',
        name: 'John Driver',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ phone: null }),
      });
    });

    it('should throw 409 when email already exists', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(PROVIDER_ID, {
          email: 'taken@example.com',
          password: 'StrongPass1',
          name: 'John Driver',
        }),
      ).rejects.toThrow(AppError);

      try {
        await service.create(PROVIDER_ID, {
          email: 'taken@example.com',
          password: 'StrongPass1',
          name: 'John Driver',
        });
      } catch (error) {
        const appError = error as AppError;
        expect(appError.statusCode).toBe(409);
        expect(appError.code).toBe(ErrorCodes.AUTH_EMAIL_TAKEN);
      }
    });
  });

  describe('delete', () => {
    it('should unassign from schedules and delete driver', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
        role: 'DRIVER',
      });

      await service.delete(DRIVER_ID, PROVIDER_ID);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.schedule.updateMany).toHaveBeenCalledWith({
        where: { driverId: DRIVER_ID },
        data: { driverId: null },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: DRIVER_ID },
      });
    });

    it('should throw 404 when driver not found', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.delete('nonexistent', PROVIDER_ID)).rejects.toThrow(AppError);

      try {
        await service.delete('nonexistent', PROVIDER_ID);
      } catch (error) {
        const appError = error as AppError;
        expect(appError.statusCode).toBe(404);
        expect(appError.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      }
    });

    it('should throw 404 when driver belongs to another provider', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: OTHER_PROVIDER_ID,
        role: 'DRIVER',
      });

      await expect(service.delete(DRIVER_ID, PROVIDER_ID)).rejects.toThrow(AppError);

      try {
        await service.delete(DRIVER_ID, PROVIDER_ID);
      } catch (error) {
        const appError = error as AppError;
        expect(appError.statusCode).toBe(404);
        expect(appError.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      }
    });

    it('should throw 404 when user is not a DRIVER', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        providerId: PROVIDER_ID,
        role: 'PASSENGER',
      });

      await expect(service.delete(DRIVER_ID, PROVIDER_ID)).rejects.toThrow(AppError);

      try {
        await service.delete(DRIVER_ID, PROVIDER_ID);
      } catch (error) {
        const appError = error as AppError;
        expect(appError.statusCode).toBe(404);
      }
    });
  });
});
