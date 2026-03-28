import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockRouteFindMany = vi.fn();
const mockRouteCount = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockRouteDelete = vi.fn();
const mockScheduleCount = vi.fn();
const mockTransactionRouteCreate = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  user: { findUnique: mockUserFindUnique },
  route: {
    findMany: mockRouteFindMany,
    count: mockRouteCount,
    findUnique: mockRouteFindUnique,
    delete: mockRouteDelete,
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

function makeDbRoute(overrides: Record<string, unknown> = {}) {
  return {
    id: 'route-1',
    name: 'Bucharest - Cluj',
    providerId: 'prov-1',
    createdAt: new Date('2024-06-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeDbStop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stop-1',
    name: 'Bucharest',
    lat: 44.4268,
    lng: 26.1025,
    orderIndex: 0,
    routeId: 'route-1',
    ...overrides,
  };
}

describe('Route Routes', () => {
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

  // --- GET /api/v1/routes ---
  describe('GET /api/v1/routes', () => {
    it('returns 200 with paginated routes', async () => {
      mockAuthUser();
      const routes = [makeDbRoute(), makeDbRoute({ id: 'route-2', name: 'Timisoara - Iasi' })];
      mockRouteFindMany.mockResolvedValueOnce(routes);
      mockRouteCount.mockResolvedValueOnce(2);

      const response = await supertest(app.server)
        .get('/api/v1/routes')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('route-1');
      expect(response.body.data[0].name).toBe('Bucharest - Cluj');
      expect(response.body.data[0].providerId).toBe('prov-1');
      expect(response.body.data[0].createdAt).toBe('2024-06-01T10:00:00.000Z');
      expect(response.body.meta.total).toBe(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(20);
      expect(response.body.meta.totalPages).toBe(1);
    });

    it('supports pagination query params', async () => {
      mockAuthUser();
      mockRouteFindMany.mockResolvedValueOnce([makeDbRoute()]);
      mockRouteCount.mockResolvedValueOnce(25);

      const response = await supertest(app.server)
        .get('/api/v1/routes?page=2&pageSize=10')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.pageSize).toBe(10);
      expect(response.body.meta.totalPages).toBe(3);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/routes').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .get('/api/v1/routes')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  // --- POST /api/v1/routes ---
  describe('POST /api/v1/routes', () => {
    const validBody = {
      name: 'Bucharest - Cluj',
      stops: [
        { name: 'Bucharest', lat: 44.4268, lng: 26.1025, orderIndex: 0 },
        { name: 'Cluj', lat: 46.7712, lng: 23.6236, orderIndex: 1 },
      ],
    };

    it('returns 201 with created route and stops', async () => {
      mockAuthUser();
      const createdRoute = {
        ...makeDbRoute(),
        stops: [
          makeDbStop(),
          makeDbStop({ id: 'stop-2', name: 'Cluj', lat: 46.7712, lng: 23.6236, orderIndex: 1 }),
        ],
      };
      mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          route: { create: mockTransactionRouteCreate.mockResolvedValueOnce(createdRoute) },
        });
      });

      const response = await supertest(app.server)
        .post('/api/v1/routes')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(201);

      expect(response.body.data.id).toBe('route-1');
      expect(response.body.data.name).toBe('Bucharest - Cluj');
      expect(response.body.data.stops).toHaveLength(2);
      expect(response.body.data.stops[0].name).toBe('Bucharest');
      expect(response.body.data.stops[0].lat).toBe(44.4268);
      expect(response.body.data.stops[1].name).toBe('Cluj');
      expect(response.body.data.createdAt).toBe('2024-06-01T10:00:00.000Z');
    });

    it('returns 400 with less than 2 stops', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/routes')
        .set('Authorization', PROVIDER_AUTH())
        .send({
          name: 'Bad Route',
          stops: [{ name: 'Only One', lat: 44.0, lng: 26.0, orderIndex: 0 }],
        })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with missing name', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/routes')
        .set('Authorization', PROVIDER_AUTH())
        .send({ stops: validBody.stops })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with invalid coordinates', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/routes')
        .set('Authorization', PROVIDER_AUTH())
        .send({
          name: 'Bad Coords',
          stops: [
            { name: 'A', lat: 100, lng: 26.0, orderIndex: 0 },
            { name: 'B', lat: 44.0, lng: 26.0, orderIndex: 1 },
          ],
        })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('rejects unknown fields in body', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/routes')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, hacker: 'injected' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/routes')
        .send(validBody)
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .post('/api/v1/routes')
        .set('Authorization', PASSENGER_AUTH())
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- GET /api/v1/routes/:id ---
  describe('GET /api/v1/routes/:id', () => {
    it('returns 200 with route and stops', async () => {
      mockAuthUser();
      const routeWithStops = {
        ...makeDbRoute(),
        stops: [
          makeDbStop(),
          makeDbStop({ id: 'stop-2', name: 'Cluj', lat: 46.7712, lng: 23.6236, orderIndex: 1 }),
        ],
      };
      mockRouteFindUnique.mockResolvedValueOnce(routeWithStops);

      const response = await supertest(app.server)
        .get('/api/v1/routes/route-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data.id).toBe('route-1');
      expect(response.body.data.name).toBe('Bucharest - Cluj');
      expect(response.body.data.stops).toHaveLength(2);
      expect(response.body.data.stops[0].id).toBe('stop-1');
      expect(response.body.data.stops[0].lat).toBe(44.4268);
      expect(response.body.data.stops[1].orderIndex).toBe(1);
      expect(response.body.data.createdAt).toBe('2024-06-01T10:00:00.000Z');
    });

    it('returns 404 when route not found', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .get('/api/v1/routes/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for route owned by different provider', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce(makeDbRoute({ providerId: 'other-provider' }));

      const response = await supertest(app.server)
        .get('/api/v1/routes/route-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/routes/route-1').expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- DELETE /api/v1/routes/:id ---
  describe('DELETE /api/v1/routes/:id', () => {
    it('returns 204 on successful deletion', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockScheduleCount.mockResolvedValueOnce(0);
      mockRouteDelete.mockResolvedValueOnce({});

      await supertest(app.server)
        .delete('/api/v1/routes/route-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(204);

      expect(mockRouteDelete).toHaveBeenCalledWith({ where: { id: 'route-1' } });
    });

    it('returns 404 when route not found', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .delete('/api/v1/routes/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for route owned by different provider', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'other-provider' });

      const response = await supertest(app.server)
        .delete('/api/v1/routes/route-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
    });

    it('returns 409 when route has active schedules', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockScheduleCount.mockResolvedValueOnce(3);

      const response = await supertest(app.server)
        .delete('/api/v1/routes/route-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(409);

      expect(response.body.status).toBe(409);
      expect(response.body.code).toBe('CONFLICT');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).delete('/api/v1/routes/route-1').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .delete('/api/v1/routes/route-1')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });
});
