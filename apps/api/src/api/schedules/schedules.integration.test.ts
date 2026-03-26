import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockScheduleFindMany = vi.fn();
const mockScheduleCount = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockScheduleUpdate = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockBusFindUnique = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  user: { findUnique: mockUserFindUnique },
  schedule: {
    findMany: mockScheduleFindMany,
    count: mockScheduleCount,
    findUnique: mockScheduleFindUnique,
    update: mockScheduleUpdate,
  },
  route: { findUnique: mockRouteFindUnique },
  bus: { findUnique: mockBusFindUnique },
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

function makeDbSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    routeId: 'route-1',
    busId: 'bus-1',
    driverId: 'driver-1',
    departureTime: new Date('2024-07-01T08:00:00.000Z'),
    arrivalTime: new Date('2024-07-01T12:00:00.000Z'),
    daysOfWeek: [1, 3, 5],
    basePrice: 50,
    status: 'ACTIVE',
    tripDate: new Date('2024-07-01T00:00:00.000Z'),
    createdAt: new Date('2024-06-01T10:00:00.000Z'),
    ...overrides,
  };
}

interface DbScheduleWithRelations {
  id: string;
  routeId: string;
  busId: string;
  driverId: string | null;
  departureTime: Date;
  arrivalTime: Date;
  daysOfWeek: number[];
  basePrice: number;
  status: string;
  tripDate: Date;
  createdAt: Date;
  stopTimes: {
    id: string;
    stopName: string;
    arrivalTime: Date;
    departureTime: Date;
    orderIndex: number;
    priceFromStart: number;
    lat: number | null;
    lng: number | null;
  }[];
  route: {
    id: string;
    name: string;
    providerId: string;
    createdAt: Date;
  };
  bus: {
    id: string;
    licensePlate: string;
    model: string;
    capacity: number;
    rows: number;
    columns: number;
    providerId: string;
    createdAt: Date;
  };
  driver: {
    id: string;
    name: string;
    role: string;
    providerId: string;
  } | null;
}

function makeDbScheduleWithRelations(
  overrides: Record<string, unknown> = {},
): DbScheduleWithRelations {
  return {
    ...makeDbSchedule(overrides),
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: new Date('2024-07-01T08:00:00.000Z'),
        departureTime: new Date('2024-07-01T08:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
        lat: 44.4268,
        lng: 26.1025,
      },
      {
        id: 'st-2',
        stopName: 'Cluj',
        arrivalTime: new Date('2024-07-01T11:50:00.000Z'),
        departureTime: new Date('2024-07-01T12:00:00.000Z'),
        orderIndex: 1,
        priceFromStart: 50,
        lat: 46.7712,
        lng: 23.6236,
      },
    ],
    route: {
      id: 'route-1',
      name: 'Bucharest - Cluj',
      providerId: 'prov-1',
      createdAt: new Date('2024-05-01T10:00:00.000Z'),
    },
    bus: {
      id: 'bus-1',
      licensePlate: 'B-123-ABC',
      model: 'Mercedes Tourismo',
      capacity: 52,
      rows: 13,
      columns: 4,
      providerId: 'prov-1',
      createdAt: new Date('2024-05-01T10:00:00.000Z'),
    },
    driver: {
      id: 'driver-1',
      name: 'Ion Popescu',
      role: 'DRIVER',
      providerId: 'prov-1',
    },
  };
}

describe('Schedule Routes', () => {
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

  // --- GET /api/v1/schedules ---
  describe('GET /api/v1/schedules', () => {
    it('returns 200 with paginated schedules', async () => {
      mockAuthUser();
      mockScheduleFindMany.mockResolvedValueOnce([makeDbSchedule()]);
      mockScheduleCount.mockResolvedValueOnce(1);

      const response = await supertest(app.server)
        .get('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('sched-1');
      expect(response.body.data[0].routeId).toBe('route-1');
      expect(response.body.data[0].busId).toBe('bus-1');
      expect(response.body.data[0].driverId).toBe('driver-1');
      expect(response.body.data[0].departureTime).toBe('2024-07-01T08:00:00.000Z');
      expect(response.body.data[0].arrivalTime).toBe('2024-07-01T12:00:00.000Z');
      expect(response.body.data[0].daysOfWeek).toEqual([1, 3, 5]);
      expect(response.body.data[0].basePrice).toBe(50);
      expect(response.body.data[0].status).toBe('ACTIVE');
      expect(response.body.data[0].tripDate).toBe('2024-07-01');
      expect(response.body.data[0].createdAt).toBe('2024-06-01T10:00:00.000Z');
      expect(response.body.meta.total).toBe(1);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(20);
      expect(response.body.meta.totalPages).toBe(1);
    });

    it('supports pagination query params', async () => {
      mockAuthUser();
      mockScheduleFindMany.mockResolvedValueOnce([makeDbSchedule()]);
      mockScheduleCount.mockResolvedValueOnce(25);

      const response = await supertest(app.server)
        .get('/api/v1/schedules?page=2&pageSize=10')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.pageSize).toBe(10);
      expect(response.body.meta.totalPages).toBe(3);
    });

    it('supports filter query params', async () => {
      mockAuthUser();
      mockScheduleFindMany.mockResolvedValueOnce([]);
      mockScheduleCount.mockResolvedValueOnce(0);

      const response = await supertest(app.server)
        .get(
          '/api/v1/schedules?routeId=route-1&busId=bus-1&status=ACTIVE&fromDate=2024-07-01&toDate=2024-07-31',
        )
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/schedules').expect(401);
      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .get('/api/v1/schedules')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  // --- POST /api/v1/schedules ---
  describe('POST /api/v1/schedules', () => {
    const validBody = {
      routeId: 'route-1',
      busId: 'bus-1',
      driverId: 'driver-1',
      departureTime: '2024-07-01T08:00:00.000Z',
      arrivalTime: '2024-07-01T12:00:00.000Z',
      daysOfWeek: [1, 3, 5],
      basePrice: 50,
      tripDate: '2024-07-01',
      stopTimes: [
        {
          stopName: 'Bucharest',
          arrivalTime: '2024-07-01T08:00:00.000Z',
          departureTime: '2024-07-01T08:10:00.000Z',
          orderIndex: 0,
          priceFromStart: 0,
        },
        {
          stopName: 'Cluj',
          arrivalTime: '2024-07-01T11:50:00.000Z',
          departureTime: '2024-07-01T12:00:00.000Z',
          orderIndex: 1,
          priceFromStart: 50,
        },
      ],
    };

    it('returns 201 with created schedule', async () => {
      mockAuthUser();
      // Route ownership check
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      // Bus ownership check
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      // Driver ownership check
      mockUserFindUnique.mockResolvedValueOnce({ providerId: 'prov-1', role: 'DRIVER' });
      // Transaction creates and returns schedule with relations
      mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          schedule: {
            create: vi.fn().mockResolvedValueOnce(makeDbScheduleWithRelations()),
          },
        };
        return fn(tx);
      });

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(201);

      expect(response.body.data.id).toBe('sched-1');
      expect(response.body.data.routeId).toBe('route-1');
      expect(response.body.data.busId).toBe('bus-1');
      expect(response.body.data.driverId).toBe('driver-1');
      expect(response.body.data.departureTime).toBe('2024-07-01T08:00:00.000Z');
      expect(response.body.data.arrivalTime).toBe('2024-07-01T12:00:00.000Z');
      expect(response.body.data.basePrice).toBe(50);
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.stopTimes).toHaveLength(2);
      expect(response.body.data.stopTimes[0].stopName).toBe('Bucharest');
      expect(response.body.data.stopTimes[0].orderIndex).toBe(0);
      expect(response.body.data.stopTimes[1].stopName).toBe('Cluj');
      expect(response.body.data.stopTimes[1].priceFromStart).toBe(50);
      expect(response.body.data.route.id).toBe('route-1');
      expect(response.body.data.route.name).toBe('Bucharest - Cluj');
      expect(response.body.data.bus.id).toBe('bus-1');
      expect(response.body.data.bus.licensePlate).toBe('B-123-ABC');
      expect(response.body.data.driver.id).toBe('driver-1');
      expect(response.body.data.driver.name).toBe('Ion Popescu');
    });

    it('returns 201 without optional driverId', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      const scheduleNoDriver = makeDbScheduleWithRelations({ driverId: null });
      scheduleNoDriver.driver = null;
      mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          schedule: { create: vi.fn().mockResolvedValueOnce(scheduleNoDriver) },
        };
        return fn(tx);
      });

      const { driverId: _driverId, ...bodyNoDriver } = validBody;

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send(bodyNoDriver)
        .expect(201);

      expect(response.body.data.driverId).toBeNull();
      expect(response.body.data.driver).toBeNull();
    });

    it('returns 400 with fewer than 2 stop times', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, stopTimes: [validBody.stopTimes[0]] })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 with missing required fields', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send({ routeId: 'route-1' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('rejects unknown fields in body', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send({ ...validBody, hacker: 'injected' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 404 when route not owned by provider', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'other-provider' });

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 when bus not owned by provider', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'other-provider' });

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 when driver not owned by provider', async () => {
      mockAuthUser();
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-1' });
      mockUserFindUnique.mockResolvedValueOnce({ providerId: 'other-provider', role: 'DRIVER' });

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH())
        .send(validBody)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .send(validBody)
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .post('/api/v1/schedules')
        .set('Authorization', PASSENGER_AUTH())
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- GET /api/v1/schedules/:id ---
  describe('GET /api/v1/schedules/:id', () => {
    it('returns 200 with schedule details', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce(makeDbScheduleWithRelations());

      const response = await supertest(app.server)
        .get('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data.id).toBe('sched-1');
      expect(response.body.data.stopTimes).toHaveLength(2);
      expect(response.body.data.stopTimes[0].stopName).toBe('Bucharest');
      expect(response.body.data.stopTimes[0].arrivalTime).toBe('2024-07-01T08:00:00.000Z');
      expect(response.body.data.route.id).toBe('route-1');
      expect(response.body.data.route.name).toBe('Bucharest - Cluj');
      expect(response.body.data.bus.id).toBe('bus-1');
      expect(response.body.data.bus.model).toBe('Mercedes Tourismo');
      expect(response.body.data.driver.id).toBe('driver-1');
      expect(response.body.data.driver.name).toBe('Ion Popescu');
    });

    it('returns 200 with null driver when unassigned', async () => {
      mockAuthUser();
      const scheduleNoDriver = makeDbScheduleWithRelations({ driverId: null });
      scheduleNoDriver.driver = null;
      mockScheduleFindUnique.mockResolvedValueOnce(scheduleNoDriver);

      const response = await supertest(app.server)
        .get('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(200);

      expect(response.body.data.driverId).toBeNull();
      expect(response.body.data.driver).toBeNull();
    });

    it('returns 404 when schedule not found', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .get('/api/v1/schedules/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for schedule owned by different provider', async () => {
      mockAuthUser();
      const otherSchedule = makeDbScheduleWithRelations();
      otherSchedule.route.providerId = 'other-provider';
      mockScheduleFindUnique.mockResolvedValueOnce(otherSchedule);

      const response = await supertest(app.server)
        .get('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/schedules/sched-1').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .get('/api/v1/schedules/sched-1')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- PUT /api/v1/schedules/:id ---
  describe('PUT /api/v1/schedules/:id', () => {
    it('returns 200 with updated schedule (assign driver)', async () => {
      mockAuthUser();
      // Ownership check
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'prov-1' },
      });
      // Driver ownership check
      mockUserFindUnique.mockResolvedValueOnce({ providerId: 'prov-1', role: 'DRIVER' });
      // Update returns schedule with relations
      mockScheduleUpdate.mockResolvedValueOnce(makeDbScheduleWithRelations());

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ driverId: 'driver-1' })
        .expect(200);

      expect(response.body.data.id).toBe('sched-1');
      expect(response.body.data.driver.id).toBe('driver-1');
    });

    it('returns 200 when unassigning driver (null)', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'prov-1' },
      });
      const scheduleNoDriver = makeDbScheduleWithRelations({ driverId: null });
      scheduleNoDriver.driver = null;
      mockScheduleUpdate.mockResolvedValueOnce(scheduleNoDriver);

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ driverId: null })
        .expect(200);

      expect(response.body.data.driverId).toBeNull();
      expect(response.body.data.driver).toBeNull();
    });

    it('returns 200 with updated status', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'prov-1' },
      });
      mockScheduleUpdate.mockResolvedValueOnce(
        makeDbScheduleWithRelations({ status: 'CANCELLED' }),
      );

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ status: 'CANCELLED' })
        .expect(200);

      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('returns 404 when schedule not found', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .put('/api/v1/schedules/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .send({ status: 'CANCELLED' })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for schedule owned by different provider', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'other-provider' },
      });

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ status: 'CANCELLED' })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 when assigning driver from different provider', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'prov-1' },
      });
      mockUserFindUnique.mockResolvedValueOnce({ providerId: 'other-provider', role: 'DRIVER' });

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ driverId: 'other-driver' })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 200 when updating departureTime and arrivalTime', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'prov-1' },
      });
      const updated = makeDbScheduleWithRelations({
        departureTime: new Date('2024-07-01T09:00:00.000Z'),
        arrivalTime: new Date('2024-07-01T13:00:00.000Z'),
      });
      mockScheduleUpdate.mockResolvedValueOnce(updated);

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({
          departureTime: '2024-07-01T09:00:00.000Z',
          arrivalTime: '2024-07-01T13:00:00.000Z',
        })
        .expect(200);

      expect(response.body.data.departureTime).toBe('2024-07-01T09:00:00.000Z');
      expect(response.body.data.arrivalTime).toBe('2024-07-01T13:00:00.000Z');
    });

    it('returns 200 when updating with departureTime and arrivalTime omitted', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'prov-1' },
      });
      mockScheduleUpdate.mockResolvedValueOnce(
        makeDbScheduleWithRelations({ status: 'CANCELLED' }),
      );

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ status: 'CANCELLED' })
        .expect(200);

      expect(response.body.data.id).toBe('sched-1');
      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('rejects unknown fields in body', async () => {
      mockAuthUser();

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .send({ status: 'CANCELLED', hacker: 'injected' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .send({ status: 'CANCELLED' })
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .put('/api/v1/schedules/sched-1')
        .set('Authorization', PASSENGER_AUTH())
        .send({ status: 'CANCELLED' })
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });

  // --- DELETE /api/v1/schedules/:id ---
  describe('DELETE /api/v1/schedules/:id', () => {
    it('returns 204 on successful cancellation', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'prov-1' },
      });
      mockScheduleUpdate.mockResolvedValueOnce({});

      await supertest(app.server)
        .delete('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(204);
    });

    it('returns 404 when schedule not found', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .delete('/api/v1/schedules/nonexistent')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 for schedule owned by different provider', async () => {
      mockAuthUser();
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        route: { providerId: 'other-provider' },
      });

      const response = await supertest(app.server)
        .delete('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).delete('/api/v1/schedules/sched-1').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role', async () => {
      mockAuthUser('user-2');

      const response = await supertest(app.server)
        .delete('/api/v1/schedules/sched-1')
        .set('Authorization', PASSENGER_AUTH())
        .expect(403);

      expect(response.body.status).toBe(403);
    });
  });
});
