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
const USER_ID = 'user-1';

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

function makeUserRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'user@example.com',
    name: 'Test User',
    role: 'PASSENGER',
    phone: null,
    avatarUrl: null,
    providerId: null,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

function makeAuditLogRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    userId: USER_ID,
    action: 'LOGIN_SUCCESS',
    resource: 'auth',
    resourceId: null,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    metadata: null,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let mockPrisma: {
    bus: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
    seat: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    refreshToken: { updateMany: ReturnType<typeof vi.fn> };
    auditLog: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
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
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
        count: vi.fn(),
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

      expect(mockPrisma.bus.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
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

  describe('listUsers', () => {
    it('returns paginated users with all admin-visible fields', async () => {
      const user = makeUserRecord();
      mockPrisma.user.findMany.mockResolvedValue([user]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listUsers({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: USER_ID,
        email: 'user@example.com',
        name: 'Test User',
        role: 'PASSENGER',
        phone: null,
        avatarUrl: null,
        providerId: null,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date('2026-01-15T10:00:00Z'),
        updatedAt: new Date('2026-01-15T10:00:00Z'),
      });
      expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
    });

    it('filters by role when provided', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers({ page: 1, pageSize: 20, role: 'ADMIN' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'ADMIN' } }),
      );
    });

    it('filters by status when provided', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers({ page: 1, pageSize: 20, status: 'SUSPENDED' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'SUSPENDED' } }),
      );
    });

    it('filters by both role and status when provided', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers({ page: 1, pageSize: 20, role: 'PASSENGER', status: 'LOCKED' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'PASSENGER', status: 'LOCKED' } }),
      );
    });

    it('applies correct pagination skip/take', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(50);

      const result = await service.listUsers({ page: 3, pageSize: 10 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 50, page: 3, pageSize: 10, totalPages: 5 });
    });

    it('uses select to exclude sensitive fields', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers({ page: 1, pageSize: 20 });

      const call = mockPrisma.user.findMany.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select.passwordHash).toBeUndefined();
      expect(call.select.email).toBe(true);
      expect(call.select.failedLoginAttempts).toBe(true);
    });
  });

  describe('updateUserStatus', () => {
    it('suspends a user and revokes all sessions', async () => {
      const user = makeUserRecord();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, status: 'SUSPENDED' });
      // revokeAllSessions will also call findUnique + updateMany
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.updateUserStatus(USER_ID, 'suspend');

      expect(result.status).toBe('SUSPENDED');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'SUSPENDED' } }),
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('unsuspends a user without revoking sessions', async () => {
      const user = makeUserRecord({ status: 'SUSPENDED' });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, status: 'ACTIVE' });

      const result = await service.updateUserStatus(USER_ID, 'unsuspend');

      expect(result.status).toBe('ACTIVE');
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('unlocks a user, resets failedLoginAttempts and clears lockedUntil', async () => {
      const user = makeUserRecord({
        status: 'LOCKED',
        failedLoginAttempts: 5,
        lockedUntil: new Date('2026-01-16T10:00:00Z'),
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({
        ...user,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      const result = await service.updateUserStatus(USER_ID, 'unlock');

      expect(result.status).toBe('ACTIVE');
      expect(result.failedLoginAttempts).toBe(0);
      expect(result.lockedUntil).toBeNull();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null },
        }),
      );
    });

    it('throws RESOURCE_NOT_FOUND when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserStatus('nonexistent', 'suspend')).rejects.toThrow(AppError);
      await expect(service.updateUserStatus('nonexistent', 'suspend')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });
  });

  describe('listAuditLogs', () => {
    it('returns paginated audit logs', async () => {
      const log = makeAuditLogRecord();
      mockPrisma.auditLog.findMany.mockResolvedValue([log]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.listAuditLogs({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'audit-1',
        userId: USER_ID,
        action: 'LOGIN_SUCCESS',
        resource: 'auth',
        resourceId: null,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        metadata: null,
        createdAt: new Date('2026-01-15T10:00:00Z'),
      });
      expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
    });

    it('filters by userId when provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.listAuditLogs({ page: 1, pageSize: 20, userId: USER_ID });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } }),
      );
    });

    it('filters by action when provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.listAuditLogs({ page: 1, pageSize: 20, action: 'LOGIN_FAILURE' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { action: 'LOGIN_FAILURE' } }),
      );
    });

    it('filters by date range when provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.listAuditLogs({
        page: 1,
        pageSize: 20,
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-01-31T23:59:59Z',
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt).toEqual({
        gte: new Date('2026-01-01T00:00:00Z'),
        lte: new Date('2026-01-31T23:59:59Z'),
      });
    });

    it('combines multiple filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.listAuditLogs({
        page: 1,
        pageSize: 20,
        userId: USER_ID,
        action: 'LOGIN_SUCCESS',
        dateFrom: '2026-01-01T00:00:00Z',
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe(USER_ID);
      expect(call.where.action).toBe('LOGIN_SUCCESS');
      expect(call.where.createdAt).toEqual({ gte: new Date('2026-01-01T00:00:00Z') });
    });

    it('applies correct pagination', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(100);

      const result = await service.listAuditLogs({ page: 5, pageSize: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 100, page: 5, pageSize: 10, totalPages: 10 });
    });
  });

  describe('revokeAllSessions', () => {
    it('revokes all active refresh tokens for an existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'test@example.com' });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.revokeAllSessions(USER_ID);

      expect(result).toBe(3);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('returns 0 when user has no active sessions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'test@example.com' });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.revokeAllSessions(USER_ID);

      expect(result).toBe(0);
    });

    it('throws RESOURCE_NOT_FOUND when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.revokeAllSessions('nonexistent')).rejects.toThrow(AppError);
      await expect(service.revokeAllSessions('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
    });

    it('does not revoke tokens when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.revokeAllSessions('nonexistent')).rejects.toThrow();

      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
