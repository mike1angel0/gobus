import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockUserCreate = vi.fn();
const mockUserDelete = vi.fn();
const mockScheduleUpdateMany = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    findMany: mockUserFindMany,
    count: mockUserCount,
    create: mockUserCreate,
    delete: mockUserDelete,
  },
  schedule: { updateMany: mockScheduleUpdateMany },
  $transaction: mockTransaction,
};

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/transio_test',
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

const PROVIDER_AUTH = () =>
  createAuthHeader('user-1', 'PROVIDER', {
    email: 'provider@test.com',
    providerId: 'prov-1',
  });

const PASSENGER_AUTH = () =>
  createAuthHeader('user-2', 'PASSENGER', {
    email: 'passenger@test.com',
  });

function mockAuthUser(id = 'user-1') {
  mockUserFindUnique.mockResolvedValueOnce({ id, status: 'ACTIVE' });
}

function makeDbDriver(overrides: Record<string, unknown> = {}) {
  return {
    id: 'driver-1',
    email: 'driver@test.com',
    name: 'Test Driver',
    role: 'DRIVER',
    phone: '+40712345678',
    status: 'ACTIVE',
    providerId: 'prov-1',
    passwordHash: '$2a$12$hashed',
    createdAt: new Date('2024-06-01T10:00:00.000Z'),
    updatedAt: new Date('2024-06-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('Driver Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- GET /api/v1/drivers ---
  describe('GET /api/v1/drivers', () => {
    it('returns 200 with paginated drivers', async () => {
      mockAuthUser();
      const drivers = [
        { ...makeDbDriver(), _count: { driverSchedules: 3 } },
        { ...makeDbDriver({ id: 'driver-2', email: 'driver2@test.com', name: 'Driver Two' }), _count: { driverSchedules: 0 } },
      ];
      mockUserFindMany.mockResolvedValueOnce(drivers);
      mockUserCount.mockResolvedValueOnce(2);

      const response = await supertest(app.server)
        .get('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('driver-1');
      expect(response.body.data[0].email).toBe('driver@test.com');
      expect(response.body.data[0].name).toBe('Test Driver');
      expect(response.body.data[0].role).toBe('DRIVER');
      expect(response.body.data[0].phone).toBe('+40712345678');
      expect(response.body.data[0].status).toBe('ACTIVE');
      expect(response.body.data[0].providerId).toBe('prov-1');
      expect(response.body.data[0].assignedScheduleCount).toBe(3);
      expect(response.body.data[0].createdAt).toBe('2024-06-01T10:00:00.000Z');
      expect(response.body.data[1].assignedScheduleCount).toBe(0);
      expect(response.body.meta.total).toBe(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(20);
      expect(response.body.meta.totalPages).toBe(1);
    });

    it('supports pagination query params', async () => {
      mockAuthUser();
      mockUserFindMany.mockResolvedValueOnce([
        { ...makeDbDriver(), _count: { driverSchedules: 0 } },
      ]);
      mockUserCount.mockResolvedValueOnce(25);

      const response = await supertest(app.server)
        .get('/api/v1/drivers?page=2&pageSize=10')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.pageSize).toBe(10);
      expect(response.body.meta.totalPages).toBe(3);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/drivers').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .get('/api/v1/drivers')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  // --- POST /api/v1/drivers ---
  describe('POST /api/v1/drivers', () => {
    const validBody = {
      email: 'newdriver@test.com',
      password: 'SecurePass1',
      name: 'New Driver',
      phone: '+40712345678',
    };

    it('returns 201 with created driver', async () => {
      mockAuthUser();
      // Email uniqueness check
      mockUserFindUnique.mockResolvedValueOnce(null);
      mockUserCreate.mockResolvedValueOnce(
        makeDbDriver({ email: 'newdriver@test.com', name: 'New Driver' }),
      );

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(201);

      expect(response.body.data.email).toBe('newdriver@test.com');
      expect(response.body.data.name).toBe('New Driver');
      expect(response.body.data.role).toBe('DRIVER');
      expect(response.body.data.providerId).toBe('prov-1');
      expect(response.body.data.createdAt).toBe('2024-06-01T10:00:00.000Z');
      // Password should NOT be in the response
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('returns 400 with missing email', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, email: undefined })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with missing password', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, password: undefined })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with missing name', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, name: undefined })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with weak password (no uppercase)', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, password: 'weakpass1' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with short password', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, password: 'Ab1' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('rejects unknown fields in body', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, hacker: 'injected' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 409 when email already exists', async () => {
      mockAuthUser();
      // Email uniqueness check — found existing
      mockUserFindUnique.mockResolvedValueOnce({ id: 'existing-user' });

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(409);

      expect(response.body.status).toBe(409);
      expect(response.body.code).toBe('AUTH_EMAIL_TAKEN');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .send(validBody)
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .post('/api/v1/drivers')
        .set('Authorization', PASSENGER_AUTH())
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- DELETE /api/v1/drivers/:id ---
  describe('DELETE /api/v1/drivers/:id', () => {
    it('returns 204 on successful deletion', async () => {
      mockAuthUser();
      // Ownership check
      mockUserFindUnique.mockResolvedValueOnce({ providerId: 'prov-1', role: 'DRIVER' });
      mockTransaction.mockResolvedValueOnce(undefined);

      await supertest(app.server)
        .delete('/api/v1/drivers/driver-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(204);

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when driver not found', async () => {
      mockAuthUser();
      mockUserFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .delete('/api/v1/drivers/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for driver owned by different provider', async () => {
      mockAuthUser();
      mockUserFindUnique.mockResolvedValueOnce({ providerId: 'other-provider', role: 'DRIVER' });

      const response = await supertest(app.server)
        .delete('/api/v1/drivers/driver-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .delete('/api/v1/drivers/driver-1')
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .delete('/api/v1/drivers/driver-1')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });
});
