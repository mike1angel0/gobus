import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from './audit.service.js';
import { AuditActions } from '@/domain/audit/audit-actions.js';

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const USER_ID = 'user-1';
const NOW = new Date('2026-03-25T10:00:00Z');

function makeAuditRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    userId: USER_ID,
    action: AuditActions.LOGIN_SUCCESS,
    resource: 'user',
    resourceId: USER_ID,
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    metadata: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: {
    auditLog: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue(makeAuditRecord()),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    service = new AuditService(mockPrisma as never);
  });

  describe('log()', () => {
    it('creates an audit log entry with all fields', () => {
      service.log({
        userId: USER_ID,
        action: AuditActions.LOGIN_SUCCESS,
        resource: 'user',
        resourceId: USER_ID,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { browser: 'Chrome' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          action: 'LOGIN_SUCCESS',
          resource: 'user',
          resourceId: USER_ID,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: { browser: 'Chrome' },
        },
      });
    });

    it('handles optional fields with null defaults', () => {
      service.log({
        action: AuditActions.LOGIN_FAILURE,
        resource: 'user',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'LOGIN_FAILURE',
          resource: 'user',
          resourceId: null,
          ipAddress: null,
          userAgent: null,
          metadata: undefined,
        },
      });
    });

    it('does not throw when Prisma create fails (fire-and-forget)', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB connection lost'));

      // Should not throw
      service.log({
        action: AuditActions.REGISTER,
        resource: 'user',
        resourceId: 'user-2',
      });

      // Wait for the promise rejection to be caught
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    });

    it('logs all security event types', () => {
      const securityActions = [
        AuditActions.LOGIN_SUCCESS,
        AuditActions.LOGIN_FAILURE,
        AuditActions.LOGIN_LOCKED,
        AuditActions.REGISTER,
        AuditActions.LOGOUT,
        AuditActions.PASSWORD_RESET_REQUEST,
        AuditActions.PASSWORD_RESET_COMPLETE,
        AuditActions.PASSWORD_CHANGE,
        AuditActions.ACCOUNT_SUSPENDED,
        AuditActions.ACCOUNT_LOCKED,
      ] as const;

      for (const action of securityActions) {
        service.log({ action, resource: 'user', userId: USER_ID });
      }

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(10);
    });

    it('logs booking event types', () => {
      service.log({
        action: AuditActions.BOOKING_CREATED,
        resource: 'booking',
        resourceId: 'booking-1',
        userId: USER_ID,
      });
      service.log({
        action: AuditActions.BOOKING_CANCELLED,
        resource: 'booking',
        resourceId: 'booking-1',
        userId: USER_ID,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'BOOKING_CREATED' }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'BOOKING_CANCELLED' }),
        }),
      );
    });

    it('captures IP address and user agent from input', () => {
      service.log({
        action: AuditActions.LOGIN_SUCCESS,
        resource: 'user',
        userId: USER_ID,
        ipAddress: '10.0.0.1',
        userAgent: 'CustomApp/2.0',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'CustomApp/2.0',
        }),
      });
    });
  });

  describe('getByUser()', () => {
    it('returns paginated audit logs for a user', async () => {
      const records = [
        makeAuditRecord({ id: 'audit-1' }),
        makeAuditRecord({ id: 'audit-2', action: AuditActions.LOGOUT }),
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(records);
      mockPrisma.auditLog.count.mockResolvedValue(2);

      const result = await service.getByUser({ userId: USER_ID, page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'audit-1',
        userId: USER_ID,
        action: 'LOGIN_SUCCESS',
        resource: 'user',
        resourceId: USER_ID,
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
        metadata: null,
        createdAt: NOW,
      });
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('queries with correct skip/take for page 2', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(25);

      await service.getByUser({ userId: USER_ID, page: 2, pageSize: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });

    it('returns empty result when user has no audit logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await service.getByUser({ userId: USER_ID, page: 1, pageSize: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });

    it('orders results by createdAt descending', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.getByUser({ userId: USER_ID, page: 1, pageSize: 20 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('computes totalPages correctly for partial last page', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(25);

      const result = await service.getByUser({ userId: USER_ID, page: 1, pageSize: 10 });

      expect(result.meta.totalPages).toBe(3);
    });
  });
});
