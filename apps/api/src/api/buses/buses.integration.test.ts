import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockBusFindMany = vi.fn();
const mockBusCount = vi.fn();
const mockBusFindUnique = vi.fn();
const mockBusDelete = vi.fn();
const mockBusUpdate = vi.fn();
const mockScheduleCount = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  user: { findUnique: mockUserFindUnique },
  bus: {
    findMany: mockBusFindMany,
    count: mockBusCount,
    findUnique: mockBusFindUnique,
    delete: mockBusDelete,
    update: mockBusUpdate,
  },
  schedule: { count: mockScheduleCount },
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

function makeDbBus(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bus-1',
    licensePlate: 'B-123-ABC',
    model: 'Mercedes Tourismo',
    capacity: 52,
    rows: 13,
    columns: 4,
    providerId: 'prov-1',
    createdAt: new Date('2024-06-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeDbSeat(overrides: Record<string, unknown> = {}) {
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

describe('Bus Routes', () => {
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

  // --- GET /api/v1/buses ---
  describe('GET /api/v1/buses', () => {
    it('returns 200 with paginated buses', async () => {
      mockAuthUser();
      const buses = [makeDbBus(), makeDbBus({ id: 'bus-2', licensePlate: 'CJ-456-DEF' })];
      mockBusFindMany.mockResolvedValueOnce(buses);
      mockBusCount.mockResolvedValueOnce(2);

      const response = await supertest(app.server)
        .get('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('bus-1');
      expect(response.body.data[0].licensePlate).toBe('B-123-ABC');
      expect(response.body.data[0].model).toBe('Mercedes Tourismo');
      expect(response.body.data[0].capacity).toBe(52);
      expect(response.body.data[0].rows).toBe(13);
      expect(response.body.data[0].columns).toBe(4);
      expect(response.body.data[0].providerId).toBe('prov-1');
      expect(response.body.data[0].createdAt).toBe('2024-06-01T10:00:00.000Z');
      expect(response.body.meta.total).toBe(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(20);
      expect(response.body.meta.totalPages).toBe(1);
    });

    it('supports pagination query params', async () => {
      mockAuthUser();
      mockBusFindMany.mockResolvedValueOnce([makeDbBus()]);
      mockBusCount.mockResolvedValueOnce(25);

      const response = await supertest(app.server)
        .get('/api/v1/buses?page=2&pageSize=10')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.pageSize).toBe(10);
      expect(response.body.meta.totalPages).toBe(3);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/buses').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .get('/api/v1/buses')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  // --- POST /api/v1/buses ---
  describe('POST /api/v1/buses', () => {
    const validBody = {
      licensePlate: 'B-123-ABC',
      model: 'Mercedes Tourismo',
      capacity: 4,
      rows: 2,
      columns: 2,
      seats: [
        { row: 1, column: 1, label: '1A', type: 'STANDARD', price: 0 },
        { row: 1, column: 2, label: '1B', type: 'PREMIUM', price: 10 },
        { row: 2, column: 1, label: '2A', type: 'STANDARD', price: 0 },
        { row: 2, column: 2, label: '2B', type: 'STANDARD', price: 0 },
      ],
    };

    it('returns 201 with created bus and seats', async () => {
      mockAuthUser();
      // findUnique for license plate check
      mockBusFindUnique.mockResolvedValueOnce(null);
      const createdBus = {
        ...makeDbBus({ capacity: 4, rows: 2, columns: 2 }),
        seats: [
          makeDbSeat(),
          makeDbSeat({ id: 'seat-2', column: 2, label: '1B', type: 'PREMIUM', price: 10 }),
          makeDbSeat({ id: 'seat-3', row: 2, label: '2A' }),
          makeDbSeat({ id: 'seat-4', row: 2, column: 2, label: '2B' }),
        ],
      };
      mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          bus: { create: vi.fn().mockResolvedValueOnce(createdBus) },
        });
      });

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(201);

      expect(response.body.data.id).toBe('bus-1');
      expect(response.body.data.licensePlate).toBe('B-123-ABC');
      expect(response.body.data.model).toBe('Mercedes Tourismo');
      expect(response.body.data.seats).toHaveLength(4);
      expect(response.body.data.seats[0].label).toBe('1A');
      expect(response.body.data.seats[0].type).toBe('STANDARD');
      expect(response.body.data.seats[1].type).toBe('PREMIUM');
      expect(response.body.data.seats[1].price).toBe(10);
      expect(response.body.data.createdAt).toBe('2024-06-01T10:00:00.000Z');
    });

    it('returns 400 with missing licensePlate', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, licensePlate: undefined })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with rows out of range', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, rows: 0 })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with columns out of range', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, columns: 11 })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with empty seats array', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, seats: [] })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('rejects unknown fields in body', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, hacker: 'injected' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 409 when license plate already exists', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce({ id: 'existing-bus' });

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(409);

      expect(response.body.status).toBe(409);
      expect(response.body.code).toBe('CONFLICT');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .send(validBody)
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .post('/api/v1/buses')
        .set('Authorization', PASSENGER_AUTH())
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- GET /api/v1/buses/:id ---
  describe('GET /api/v1/buses/:id', () => {
    it('returns 200 with bus and seats', async () => {
      mockAuthUser();
      const busWithSeats = {
        ...makeDbBus(),
        seats: [makeDbSeat(), makeDbSeat({ id: 'seat-2', column: 2, label: '1B' })],
      };
      mockBusFindUnique.mockResolvedValueOnce(busWithSeats);

      const response = await supertest(app.server)
        .get('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data.id).toBe('bus-1');
      expect(response.body.data.licensePlate).toBe('B-123-ABC');
      expect(response.body.data.seats).toHaveLength(2);
      expect(response.body.data.seats[0].id).toBe('seat-1');
      expect(response.body.data.seats[0].label).toBe('1A');
      expect(response.body.data.seats[1].label).toBe('1B');
      expect(response.body.data.createdAt).toBe('2024-06-01T10:00:00.000Z');
    });

    it('returns 404 when bus not found', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .get('/api/v1/buses/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for bus owned by different provider', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce(
        makeDbBus({ providerId: 'other-provider', seats: [] }),
      );

      const response = await supertest(app.server)
        .get('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/buses/bus-1').expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- PUT /api/v1/buses/:id ---
  describe('PUT /api/v1/buses/:id', () => {
    it('returns 200 with updated bus', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      const updatedBus = {
        ...makeDbBus({ model: 'Setra S515' }),
        seats: [makeDbSeat()],
      };
      mockBusUpdate.mockResolvedValueOnce(updatedBus);

      const response = await supertest(app.server)
        .put('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ model: 'Setra S515' })
        .expect(200);

      expect(response.body.data.model).toBe('Setra S515');
      expect(response.body.data.seats).toHaveLength(1);
    });

    it('returns 404 when bus not found', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .put('/api/v1/buses/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .send({ model: 'New Model' })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for bus owned by different provider', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'other-provider' });

      const response = await supertest(app.server)
        .put('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ model: 'New Model' })
        .expect(404);

      expect(response.body.status).toBe(404);
    });

    it('returns 409 when new license plate already exists', async () => {
      mockAuthUser();
      mockBusFindUnique
        .mockResolvedValueOnce({ providerId: 'prov-1' }) // ownership check
        .mockResolvedValueOnce({ id: 'other-bus' }); // license plate conflict

      const response = await supertest(app.server)
        .put('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ licensePlate: 'CJ-999-XYZ' })
        .expect(409);

      expect(response.body.status).toBe(409);
      expect(response.body.code).toBe('CONFLICT');
    });

    it('rejects unknown fields in body', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .put('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ model: 'New Model', hacker: 'injected' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .put('/api/v1/buses/bus-1')
        .send({ model: 'New Model' })
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .put('/api/v1/buses/bus-1')
        .set('Authorization', PASSENGER_AUTH())
        .send({ model: 'New Model' })
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- DELETE /api/v1/buses/:id ---
  describe('DELETE /api/v1/buses/:id', () => {
    it('returns 204 on successful deletion', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockScheduleCount.mockResolvedValueOnce(0);
      mockBusDelete.mockResolvedValueOnce({});

      await supertest(app.server)
        .delete('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(204);

      expect(mockBusDelete).toHaveBeenCalledWith({ where: { id: 'bus-1' } });
    });

    it('returns 404 when bus not found', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .delete('/api/v1/buses/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for bus owned by different provider', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'other-provider' });

      const response = await supertest(app.server)
        .delete('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
    });

    it('returns 409 when bus has active schedules', async () => {
      mockAuthUser();
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockScheduleCount.mockResolvedValueOnce(3);

      const response = await supertest(app.server)
        .delete('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(409);

      expect(response.body.status).toBe(409);
      expect(response.body.code).toBe('CONFLICT');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).delete('/api/v1/buses/bus-1').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .delete('/api/v1/buses/bus-1')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- GET /api/v1/buses/templates ---
  describe('GET /api/v1/buses/templates', () => {
    it('returns 200 with list of templates', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .get('/api/v1/buses/templates')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(7);
      expect(response.body.data[0].id).toBe('coach-mercedes-tourismo');
      expect(response.body.data[0].name).toBe('Mercedes Tourismo 13x4');
      expect(response.body.data[0].rows).toBe(13);
      expect(response.body.data[0].columns).toBe(4);
      expect(response.body.data[0].capacity).toBe(52);
      expect(response.body.data[0].seats.length).toBeGreaterThan(0);
      expect(response.body.data[0].seats[0]).toHaveProperty('row');
      expect(response.body.data[0].seats[0]).toHaveProperty('column');
      expect(response.body.data[0].seats[0]).toHaveProperty('label');
      expect(response.body.data[0].seats[0]).toHaveProperty('type');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/buses/templates').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .get('/api/v1/buses/templates')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });
});
