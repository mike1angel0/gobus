import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

// --- Mock setup ---
const mockDelayFindMany = vi.fn();
const mockDelayFindUnique = vi.fn();
const mockDelayCreate = vi.fn();
const mockDelayUpdate = vi.fn();
const mockDelayUpdateMany = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  delay: {
    findMany: mockDelayFindMany,
    findUnique: mockDelayFindUnique,
    create: mockDelayCreate,
    update: mockDelayUpdate,
    updateMany: mockDelayUpdateMany,
  },
  schedule: {
    findUnique: mockScheduleFindUnique,
  },
  user: {
    findUnique: mockUserFindUnique,
  },
  $transaction: mockTransaction,
};

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod',
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

const DRIVER_ID = 'driver-1';
const PROVIDER_ID = 'provider-1';
const PASSENGER_ID = 'passenger-1';
const DRIVER_AUTH = createAuthHeader(DRIVER_ID, 'DRIVER', { providerId: PROVIDER_ID });
const PROVIDER_AUTH = createAuthHeader(PROVIDER_ID, 'PROVIDER', { providerId: PROVIDER_ID });
const PASSENGER_AUTH = createAuthHeader(PASSENGER_ID, 'PASSENGER');

function makeDelayRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delay-1',
    scheduleId: 'sched-1',
    offsetMinutes: 15,
    reason: 'TRAFFIC',
    note: null,
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    active: true,
    createdAt: new Date('2026-03-25T08:00:00.000Z'),
    ...overrides,
  };
}

function makeScheduleWithRoute(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    driverId: DRIVER_ID,
    route: { providerId: PROVIDER_ID },
    ...overrides,
  };
}

describe('Delay Routes', () => {
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
    mockUserFindUnique.mockResolvedValue({ id: DRIVER_ID, status: 'ACTIVE' });
  });

  // --- GET /api/v1/delays ---
  describe('GET /api/v1/delays', () => {
    it('returns 200 with list of delays for schedule and tripDate', async () => {
      mockDelayFindMany.mockResolvedValueOnce([
        makeDelayRecord(),
        makeDelayRecord({ id: 'delay-2', offsetMinutes: 30, reason: 'WEATHER' }),
      ]);

      const response = await supertest(app.server)
        .get('/api/v1/delays?scheduleId=sched-1&tripDate=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('delay-1');
      expect(response.body.data[0].scheduleId).toBe('sched-1');
      expect(response.body.data[0].offsetMinutes).toBe(15);
      expect(response.body.data[0].reason).toBe('TRAFFIC');
      expect(response.body.data[0].note).toBeNull();
      expect(response.body.data[0].tripDate).toBe('2026-03-25T00:00:00.000Z');
      expect(response.body.data[0].active).toBe(true);
      expect(response.body.data[0].createdAt).toBe('2026-03-25T08:00:00.000Z');
      expect(response.body.data[1].id).toBe('delay-2');
      expect(response.body.data[1].offsetMinutes).toBe(30);
      expect(response.body.data[1].reason).toBe('WEATHER');
    });

    it('returns 200 with empty array when no delays match', async () => {
      mockDelayFindMany.mockResolvedValueOnce([]);

      const response = await supertest(app.server)
        .get('/api/v1/delays?scheduleId=sched-1&tripDate=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('returns 400 when scheduleId is missing', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/delays?tripDate=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when tripDate is missing', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/delays?scheduleId=sched-1')
        .set('Authorization', DRIVER_AUTH)
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when tripDate is invalid format', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/delays?scheduleId=sched-1&tripDate=not-a-date')
        .set('Authorization', DRIVER_AUTH)
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/delays?scheduleId=sched-1&tripDate=2026-03-25')
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- POST /api/v1/delays ---
  describe('POST /api/v1/delays', () => {
    const validBody = {
      scheduleId: 'sched-1',
      offsetMinutes: 15,
      reason: 'TRAFFIC',
      tripDate: '2026-03-25',
    };

    it('returns 201 when driver creates delay successfully', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleWithRoute());
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const txClient = {
          delay: {
            updateMany: mockDelayUpdateMany,
            create: mockDelayCreate,
          },
        };
        mockDelayCreate.mockResolvedValueOnce(makeDelayRecord());
        return cb(txClient);
      });

      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', DRIVER_AUTH)
        .send(validBody)
        .expect(201);

      expect(response.body.data.id).toBe('delay-1');
      expect(response.body.data.scheduleId).toBe('sched-1');
      expect(response.body.data.offsetMinutes).toBe(15);
      expect(response.body.data.reason).toBe('TRAFFIC');
      expect(response.body.data.active).toBe(true);
    });

    it('returns 201 when provider creates delay with note', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleWithRoute());
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const txClient = {
          delay: {
            updateMany: mockDelayUpdateMany,
            create: mockDelayCreate,
          },
        };
        mockDelayCreate.mockResolvedValueOnce(
          makeDelayRecord({ note: 'Heavy congestion on highway' }),
        );
        return cb(txClient);
      });

      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', PROVIDER_AUTH)
        .send({ ...validBody, note: 'Heavy congestion on highway' })
        .expect(201);

      expect(response.body.data.note).toBe('Heavy congestion on highway');
    });

    it('returns 403 when passenger tries to create delay', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PASSENGER_ID, status: 'ACTIVE' });

      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', PASSENGER_AUTH)
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 403 when driver is not assigned to schedule', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(
        makeScheduleWithRoute({ driverId: 'other-driver' }),
      );

      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', DRIVER_AUTH)
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 404 when schedule does not exist', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', DRIVER_AUTH)
        .send(validBody)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 400 when required fields are missing', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', DRIVER_AUTH)
        .send({ scheduleId: 'sched-1' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when offsetMinutes is out of range', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', DRIVER_AUTH)
        .send({ ...validBody, offsetMinutes: 1441 })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when reason is invalid', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', DRIVER_AUTH)
        .send({ ...validBody, reason: 'INVALID_REASON' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when unknown fields are present (strict parsing)', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .set('Authorization', DRIVER_AUTH)
        .send({ ...validBody, unknownField: 'test' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/delays')
        .send(validBody)
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- PUT /api/v1/delays/:id ---
  describe('PUT /api/v1/delays/:id', () => {
    it('returns 200 when provider updates delay successfully', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });
      mockDelayFindUnique.mockResolvedValueOnce({
        ...makeDelayRecord(),
        schedule: { route: { providerId: PROVIDER_ID } },
      });
      mockDelayUpdate.mockResolvedValueOnce(makeDelayRecord({ offsetMinutes: 30 }));

      const response = await supertest(app.server)
        .put('/api/v1/delays/delay-1')
        .set('Authorization', PROVIDER_AUTH)
        .send({ offsetMinutes: 30 })
        .expect(200);

      expect(response.body.data.offsetMinutes).toBe(30);
    });

    it('returns 200 when provider deactivates delay', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });
      mockDelayFindUnique.mockResolvedValueOnce({
        ...makeDelayRecord(),
        schedule: { route: { providerId: PROVIDER_ID } },
      });
      mockDelayUpdate.mockResolvedValueOnce(makeDelayRecord({ active: false }));

      const response = await supertest(app.server)
        .put('/api/v1/delays/delay-1')
        .set('Authorization', PROVIDER_AUTH)
        .send({ active: false })
        .expect(200);

      expect(response.body.data.active).toBe(false);
    });

    it('returns 200 when provider sets note to null', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });
      mockDelayFindUnique.mockResolvedValueOnce({
        ...makeDelayRecord({ note: 'old note' }),
        schedule: { route: { providerId: PROVIDER_ID } },
      });
      mockDelayUpdate.mockResolvedValueOnce(makeDelayRecord({ note: null }));

      const response = await supertest(app.server)
        .put('/api/v1/delays/delay-1')
        .set('Authorization', PROVIDER_AUTH)
        .send({ note: null })
        .expect(200);

      expect(response.body.data.note).toBeNull();
    });

    it('returns 403 when non-provider tries to update delay', async () => {
      const response = await supertest(app.server)
        .put('/api/v1/delays/delay-1')
        .set('Authorization', DRIVER_AUTH)
        .send({ offsetMinutes: 30 })
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 404 when delay does not exist', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });
      mockDelayFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .put('/api/v1/delays/nonexistent')
        .set('Authorization', PROVIDER_AUTH)
        .send({ offsetMinutes: 30 })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 when delay belongs to another provider', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });
      mockDelayFindUnique.mockResolvedValueOnce({
        ...makeDelayRecord(),
        schedule: { route: { providerId: 'other-provider' } },
      });

      const response = await supertest(app.server)
        .put('/api/v1/delays/delay-1')
        .set('Authorization', PROVIDER_AUTH)
        .send({ offsetMinutes: 30 })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 400 when unknown fields are present', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });

      const response = await supertest(app.server)
        .put('/api/v1/delays/delay-1')
        .set('Authorization', PROVIDER_AUTH)
        .send({ offsetMinutes: 30, unknownField: 'test' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .put('/api/v1/delays/delay-1')
        .send({ offsetMinutes: 30 })
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });
});
