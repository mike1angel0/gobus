import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

// --- Mock setup ---
const mockBusFindMany = vi.fn();
const mockBusCount = vi.fn();
const mockSeatFindUnique = vi.fn();
const mockSeatUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockRefreshTokenUpdateMany = vi.fn();

const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockUserUpdate = vi.fn();
const mockAuditLogFindMany = vi.fn();
const mockAuditLogCount = vi.fn();
const mockAuditLogCreate = vi.fn();

const mockPrisma = {
  bus: {
    findMany: mockBusFindMany,
    count: mockBusCount,
  },
  seat: {
    findUnique: mockSeatFindUnique,
    update: mockSeatUpdate,
  },
  user: {
    findUnique: mockUserFindUnique,
    findMany: mockUserFindMany,
    count: mockUserCount,
    update: mockUserUpdate,
  },
  refreshToken: {
    updateMany: mockRefreshTokenUpdateMany,
  },
  auditLog: {
    findMany: mockAuditLogFindMany,
    count: mockAuditLogCount,
    create: mockAuditLogCreate,
  },
};

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/gobus_test',
  }),
}));

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const ADMIN_ID = 'admin-1';
const PASSENGER_ID = 'passenger-1';
const PROVIDER_ID = 'provider-1';
const ADMIN_AUTH = createAuthHeader(ADMIN_ID, 'ADMIN');
const PASSENGER_AUTH = createAuthHeader(PASSENGER_ID, 'PASSENGER');
const PROVIDER_AUTH = createAuthHeader(PROVIDER_ID, 'PROVIDER', { providerId: PROVIDER_ID });

function makeBusRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bus-1',
    licensePlate: 'AB-123-CD',
    model: 'Mercedes Tourismo',
    capacity: 52,
    rows: 13,
    columns: 4,
    providerId: 'provider-1',
    provider: { name: 'Test Provider' },
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeSeatRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seat-1',
    row: 1,
    column: 1,
    label: '1A',
    type: 'STANDARD',
    price: 0,
    isEnabled: true,
    busId: 'bus-1',
    ...overrides,
  };
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindUnique.mockResolvedValue({
    id: ADMIN_ID,
    email: 'admin@test.com',
    name: 'Admin',
    role: 'ADMIN',
    providerId: null,
    phone: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

describe('GET /api/v1/admin/buses', () => {
  it('returns paginated bus list for admin', async () => {
    const bus = makeBusRecord();
    mockBusFindMany.mockResolvedValue([bus]);
    mockBusCount.mockResolvedValue(1);

    const res = await supertest(app.server)
      .get('/api/v1/admin/buses')
      .set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual({
      id: 'bus-1',
      licensePlate: 'AB-123-CD',
      model: 'Mercedes Tourismo',
      capacity: 52,
      rows: 13,
      columns: 4,
      providerId: 'provider-1',
      providerName: 'Test Provider',
      createdAt: '2026-03-01T10:00:00.000Z',
    });
    expect(res.body.meta).toEqual({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('returns empty list when no buses exist', async () => {
    mockBusFindMany.mockResolvedValue([]);
    mockBusCount.mockResolvedValue(0);

    const res = await supertest(app.server)
      .get('/api/v1/admin/buses')
      .set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.totalPages).toBe(0);
  });

  it('filters by providerId when provided', async () => {
    mockBusFindMany.mockResolvedValue([]);
    mockBusCount.mockResolvedValue(0);

    await supertest(app.server)
      .get('/api/v1/admin/buses?providerId=provider-1')
      .set('Authorization', ADMIN_AUTH);

    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId: 'provider-1' },
      }),
    );
    expect(mockBusCount).toHaveBeenCalledWith({ where: { providerId: 'provider-1' } });
  });

  it('applies custom pagination parameters', async () => {
    mockBusFindMany.mockResolvedValue([]);
    mockBusCount.mockResolvedValue(0);

    await supertest(app.server)
      .get('/api/v1/admin/buses?page=2&pageSize=5')
      .set('Authorization', ADMIN_AUTH);

    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      }),
    );
  });

  it('returns 403 for PASSENGER role', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: PASSENGER_ID,
      email: 'passenger@test.com',
      name: 'Passenger',
      role: 'PASSENGER',
      providerId: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await supertest(app.server)
      .get('/api/v1/admin/buses')
      .set('Authorization', PASSENGER_AUTH);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe(403);
  });

  it('returns 403 for PROVIDER role', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: PROVIDER_ID,
      email: 'provider@test.com',
      name: 'Provider',
      role: 'PROVIDER',
      providerId: PROVIDER_ID,
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await supertest(app.server)
      .get('/api/v1/admin/buses')
      .set('Authorization', PROVIDER_AUTH);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe(403);
  });

  it('returns 401 without auth header', async () => {
    const res = await supertest(app.server).get('/api/v1/admin/buses');

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/admin/seats/:id', () => {
  it('disables a seat', async () => {
    const seat = makeSeatRecord({ isEnabled: true });
    const updatedSeat = { ...seat, isEnabled: false };
    mockSeatFindUnique.mockResolvedValue(seat);
    mockSeatUpdate.mockResolvedValue(updatedSeat);

    const res = await supertest(app.server)
      .patch('/api/v1/admin/seats/seat-1')
      .set('Authorization', ADMIN_AUTH)
      .send({ isEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: 'seat-1',
      row: 1,
      column: 1,
      label: '1A',
      type: 'STANDARD',
      price: 0,
      isEnabled: false,
    });
  });

  it('enables a seat', async () => {
    const seat = makeSeatRecord({ isEnabled: false });
    const updatedSeat = { ...seat, isEnabled: true };
    mockSeatFindUnique.mockResolvedValue(seat);
    mockSeatUpdate.mockResolvedValue(updatedSeat);

    const res = await supertest(app.server)
      .patch('/api/v1/admin/seats/seat-1')
      .set('Authorization', ADMIN_AUTH)
      .send({ isEnabled: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isEnabled).toBe(true);
  });

  it('returns 404 when seat not found', async () => {
    mockSeatFindUnique.mockResolvedValue(null);

    const res = await supertest(app.server)
      .patch('/api/v1/admin/seats/nonexistent')
      .set('Authorization', ADMIN_AUTH)
      .send({ isEnabled: false });

    expect(res.status).toBe(404);
    expect(res.body.status).toBe(404);
  });

  it('returns 400 for missing isEnabled field', async () => {
    const res = await supertest(app.server)
      .patch('/api/v1/admin/seats/seat-1')
      .set('Authorization', ADMIN_AUTH)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown fields (strict mode)', async () => {
    const res = await supertest(app.server)
      .patch('/api/v1/admin/seats/seat-1')
      .set('Authorization', ADMIN_AUTH)
      .send({ isEnabled: true, extra: 'field' });

    expect(res.status).toBe(400);
  });

  it('returns 403 for PASSENGER role', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: PASSENGER_ID,
      email: 'passenger@test.com',
      name: 'Passenger',
      role: 'PASSENGER',
      providerId: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await supertest(app.server)
      .patch('/api/v1/admin/seats/seat-1')
      .set('Authorization', PASSENGER_AUTH)
      .send({ isEnabled: false });

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth header', async () => {
    const res = await supertest(app.server)
      .patch('/api/v1/admin/seats/seat-1')
      .send({ isEnabled: false });

    expect(res.status).toBe(401);
  });
});

function makeUserRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Test User',
    role: 'PASSENGER',
    phone: '+40712345678',
    avatarUrl: null,
    providerId: null,
    provider: null,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    deletedAt: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides,
  };
}

function makeAuditLogRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    userId: 'user-1',
    action: 'LOGIN_SUCCESS',
    resource: 'auth',
    resourceId: null,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    metadata: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides,
  };
}

describe('GET /api/v1/admin/users', () => {
  it('returns paginated user list for admin', async () => {
    const user = makeUserRecord();
    mockUserFindMany.mockResolvedValue([user]);
    mockUserCount.mockResolvedValue(1);

    const res = await supertest(app.server)
      .get('/api/v1/admin/users')
      .set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      name: 'Test User',
      role: 'PASSENGER',
      phone: '+40712345678',
      avatarUrl: null,
      providerId: null,
      providerName: null,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      deletedAt: null,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    });
    expect(res.body.meta).toEqual({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('filters by role query parameter', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockUserCount.mockResolvedValue(0);

    await supertest(app.server)
      .get('/api/v1/admin/users?role=ADMIN')
      .set('Authorization', ADMIN_AUTH);

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, role: 'ADMIN' } }),
    );
  });

  it('filters by status query parameter', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockUserCount.mockResolvedValue(0);

    await supertest(app.server)
      .get('/api/v1/admin/users?status=SUSPENDED')
      .set('Authorization', ADMIN_AUTH);

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, status: 'SUSPENDED' } }),
    );
  });

  it('returns 403 for PASSENGER role', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: PASSENGER_ID,
      email: 'passenger@test.com',
      name: 'Passenger',
      role: 'PASSENGER',
      providerId: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await supertest(app.server)
      .get('/api/v1/admin/users')
      .set('Authorization', PASSENGER_AUTH);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth header', async () => {
    const res = await supertest(app.server).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/admin/users/:id/status', () => {
  it('suspends a user and returns updated user', async () => {
    const user = makeUserRecord();
    mockUserFindUnique
      .mockResolvedValueOnce({
        id: ADMIN_ID,
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        providerId: null,
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(user) // updateUserStatus findUnique
      .mockResolvedValueOnce(user); // revokeAllSessions findUnique
    mockUserUpdate.mockResolvedValue({ ...user, status: 'SUSPENDED' });
    mockRefreshTokenUpdateMany.mockResolvedValue({ count: 1 });
    mockAuditLogCreate.mockResolvedValue({});

    const res = await supertest(app.server)
      .patch('/api/v1/admin/users/user-1/status')
      .set('Authorization', ADMIN_AUTH)
      .send({ action: 'suspend' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUSPENDED');
    expect(res.body.data.id).toBe('user-1');
  });

  it('unsuspends a user', async () => {
    const user = makeUserRecord({ status: 'SUSPENDED' });
    mockUserFindUnique
      .mockResolvedValueOnce({
        id: ADMIN_ID,
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        providerId: null,
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(user);
    mockUserUpdate.mockResolvedValue({ ...user, status: 'ACTIVE' });
    mockAuditLogCreate.mockResolvedValue({});

    const res = await supertest(app.server)
      .patch('/api/v1/admin/users/user-1/status')
      .set('Authorization', ADMIN_AUTH)
      .send({ action: 'unsuspend' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('unlocks a user and resets login attempts', async () => {
    const user = makeUserRecord({
      status: 'LOCKED',
      failedLoginAttempts: 5,
      lockedUntil: new Date('2026-01-16T10:00:00Z'),
    });
    mockUserFindUnique
      .mockResolvedValueOnce({
        id: ADMIN_ID,
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        providerId: null,
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(user);
    mockUserUpdate.mockResolvedValue({
      ...user,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    mockAuditLogCreate.mockResolvedValue({});

    const res = await supertest(app.server)
      .patch('/api/v1/admin/users/user-1/status')
      .set('Authorization', ADMIN_AUTH)
      .send({ action: 'unlock' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.failedLoginAttempts).toBe(0);
    expect(res.body.data.lockedUntil).toBeNull();
  });

  it('returns 404 when user not found', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce({
        id: ADMIN_ID,
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        providerId: null,
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(null);

    const res = await supertest(app.server)
      .patch('/api/v1/admin/users/nonexistent/status')
      .set('Authorization', ADMIN_AUTH)
      .send({ action: 'suspend' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 400 for invalid action', async () => {
    const res = await supertest(app.server)
      .patch('/api/v1/admin/users/user-1/status')
      .set('Authorization', ADMIN_AUTH)
      .send({ action: 'delete' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown fields (strict mode)', async () => {
    const res = await supertest(app.server)
      .patch('/api/v1/admin/users/user-1/status')
      .set('Authorization', ADMIN_AUTH)
      .send({ action: 'suspend', extra: 'field' });

    expect(res.status).toBe(400);
  });

  it('returns 403 for PASSENGER role', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: PASSENGER_ID,
      email: 'passenger@test.com',
      name: 'Passenger',
      role: 'PASSENGER',
      providerId: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await supertest(app.server)
      .patch('/api/v1/admin/users/user-1/status')
      .set('Authorization', PASSENGER_AUTH)
      .send({ action: 'suspend' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/audit-logs', () => {
  it('returns paginated audit logs for admin', async () => {
    const log = makeAuditLogRecord();
    mockAuditLogFindMany.mockResolvedValue([log]);
    mockAuditLogCount.mockResolvedValue(1);

    const res = await supertest(app.server)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual({
      id: 'audit-1',
      userId: 'user-1',
      action: 'LOGIN_SUCCESS',
      resource: 'auth',
      resourceId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      metadata: null,
      createdAt: '2026-01-15T10:00:00.000Z',
    });
    expect(res.body.meta).toEqual({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('filters by userId query parameter', async () => {
    mockAuditLogFindMany.mockResolvedValue([]);
    mockAuditLogCount.mockResolvedValue(0);

    await supertest(app.server)
      .get('/api/v1/admin/audit-logs?userId=user-1')
      .set('Authorization', ADMIN_AUTH);

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    );
  });

  it('filters by action query parameter', async () => {
    mockAuditLogFindMany.mockResolvedValue([]);
    mockAuditLogCount.mockResolvedValue(0);

    await supertest(app.server)
      .get('/api/v1/admin/audit-logs?action=LOGIN_FAILURE')
      .set('Authorization', ADMIN_AUTH);

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: 'LOGIN_FAILURE' }) }),
    );
  });

  it('filters by date range', async () => {
    mockAuditLogFindMany.mockResolvedValue([]);
    mockAuditLogCount.mockResolvedValue(0);

    await supertest(app.server)
      .get('/api/v1/admin/audit-logs?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-01-31T23:59:59Z')
      .set('Authorization', ADMIN_AUTH);

    const call = mockAuditLogFindMany.mock.calls[0][0];
    expect(call.where.createdAt).toEqual({
      gte: new Date('2026-01-01T00:00:00Z'),
      lte: new Date('2026-01-31T23:59:59Z'),
    });
  });

  it('returns 403 for PASSENGER role', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: PASSENGER_ID,
      email: 'passenger@test.com',
      name: 'Passenger',
      role: 'PASSENGER',
      providerId: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await supertest(app.server)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', PASSENGER_AUTH);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth header', async () => {
    const res = await supertest(app.server).get('/api/v1/admin/audit-logs');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/admin/users/:id/sessions', () => {
  it('revokes all sessions and returns 204', async () => {
    // The first call is the auth plugin lookup, the second is the revokeAllSessions lookup
    mockUserFindUnique
      .mockResolvedValueOnce({
        id: ADMIN_ID,
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        providerId: null,
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'target-user',
        email: 'target@test.com',
        name: 'Target',
        role: 'PASSENGER',
        providerId: null,
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    mockRefreshTokenUpdateMany.mockResolvedValue({ count: 2 });

    const res = await supertest(app.server)
      .delete('/api/v1/admin/users/target-user/sessions')
      .set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(204);
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'target-user', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('returns 404 when user does not exist', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce({
        id: ADMIN_ID,
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        providerId: null,
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(null);

    const res = await supertest(app.server)
      .delete('/api/v1/admin/users/nonexistent/sessions')
      .set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(404);
    expect(res.body.status).toBe(404);
    expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 403 for PASSENGER role', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: PASSENGER_ID,
      email: 'passenger@test.com',
      name: 'Passenger',
      role: 'PASSENGER',
      providerId: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await supertest(app.server)
      .delete('/api/v1/admin/users/target-user/sessions')
      .set('Authorization', PASSENGER_AUTH);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth header', async () => {
    const res = await supertest(app.server).delete('/api/v1/admin/users/target-user/sessions');

    expect(res.status).toBe(401);
  });
});
