import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

// --- Mock setup ---
const mockScheduleFindMany = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockBookingCount = vi.fn();
const mockUserFindUnique = vi.fn();

const mockPrisma = {
  schedule: {
    findMany: mockScheduleFindMany,
    findUnique: mockScheduleFindUnique,
  },
  booking: {
    count: mockBookingCount,
  },
  user: {
    findUnique: mockUserFindUnique,
  },
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
const PASSENGER_ID = 'passenger-1';
const PROVIDER_ID = 'provider-1';
const DRIVER_AUTH = createAuthHeader(DRIVER_ID, 'DRIVER');
const PASSENGER_AUTH = createAuthHeader(PASSENGER_ID, 'PASSENGER');
const PROVIDER_AUTH = createAuthHeader(PROVIDER_ID, 'PROVIDER', { providerId: 'prov-1' });

function makeScheduleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    departureTime: new Date('2026-03-25T08:00:00.000Z'),
    arrivalTime: new Date('2026-03-25T12:00:00.000Z'),
    daysOfWeek: [3],
    status: 'ACTIVE',
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    driverId: DRIVER_ID,
    route: { name: 'Bucharest - Brasov' },
    bus: { licensePlate: 'B-123-ABC', model: 'Mercedes Sprinter', capacity: 50 },
    stopTimes: [
      {
        id: 'stop-1',
        stopName: 'Bucharest North',
        arrivalTime: new Date('2026-03-25T08:00:00.000Z'),
        departureTime: new Date('2026-03-25T08:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
      },
      {
        id: 'stop-2',
        stopName: 'Ploiesti',
        arrivalTime: new Date('2026-03-25T09:30:00.000Z'),
        departureTime: new Date('2026-03-25T09:40:00.000Z'),
        orderIndex: 1,
        priceFromStart: 25,
      },
      {
        id: 'stop-3',
        stopName: 'Brasov',
        arrivalTime: new Date('2026-03-25T12:00:00.000Z'),
        departureTime: new Date('2026-03-25T12:00:00.000Z'),
        orderIndex: 2,
        priceFromStart: 50,
      },
    ],
    ...overrides,
  };
}

describe('Driver Trip Routes', () => {
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

  // --- GET /api/v1/driver/trips ---
  describe('GET /api/v1/driver/trips', () => {
    it('returns 200 with list of driver trips', async () => {
      mockScheduleFindMany.mockResolvedValueOnce([makeScheduleRecord()]);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].scheduleId).toBe('sched-1');
      expect(response.body.data[0].departureTime).toBe('2026-03-25T08:00:00.000Z');
      expect(response.body.data[0].arrivalTime).toBe('2026-03-25T12:00:00.000Z');
      expect(response.body.data[0].tripDate).toBe('2026-03-25T00:00:00.000Z');
      expect(response.body.data[0].routeName).toBe('Bucharest - Brasov');
      expect(response.body.data[0].busLicensePlate).toBe('B-123-ABC');
      expect(response.body.data[0].status).toBe('ACTIVE');
    });

    it('returns 200 with empty array when no trips assigned', async () => {
      mockScheduleFindMany.mockResolvedValueOnce([]);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('returns 200 with default date when date param omitted', async () => {
      mockScheduleFindMany.mockResolvedValueOnce([]);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(mockScheduleFindMany).toHaveBeenCalledOnce();
    });

    it('returns 200 with multiple trips', async () => {
      const sched2 = makeScheduleRecord({
        id: 'sched-2',
        departureTime: new Date('2026-03-25T14:00:00.000Z'),
        arrivalTime: new Date('2026-03-25T18:00:00.000Z'),
        route: { name: 'Bucharest - Cluj' },
        bus: { licensePlate: 'B-456-DEF' },
      });
      mockScheduleFindMany.mockResolvedValueOnce([makeScheduleRecord(), sched2]);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].scheduleId).toBe('sched-1');
      expect(response.body.data[1].scheduleId).toBe('sched-2');
    });

    it('returns 403 when user is not a DRIVER', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PASSENGER_ID, status: 'ACTIVE' });

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips')
        .set('Authorization', PASSENGER_AUTH)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 403 when user is PROVIDER', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PROVIDER_ID, status: 'ACTIVE' });

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips')
        .set('Authorization', PROVIDER_AUTH)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 400 when date is invalid format', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/driver/trips?date=not-a-date')
        .set('Authorization', DRIVER_AUTH)
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/driver/trips')
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- GET /api/v1/driver/trips/:scheduleId ---
  describe('GET /api/v1/driver/trips/:scheduleId', () => {
    it('returns 200 with trip detail', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleRecord());
      mockBookingCount.mockResolvedValueOnce(15);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips/sched-1?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data.scheduleId).toBe('sched-1');
      expect(response.body.data.departureTime).toBe('2026-03-25T08:00:00.000Z');
      expect(response.body.data.arrivalTime).toBe('2026-03-25T12:00:00.000Z');
      expect(response.body.data.tripDate).toBe('2026-03-25T00:00:00.000Z');
      expect(response.body.data.routeName).toBe('Bucharest - Brasov');
      expect(response.body.data.busLicensePlate).toBe('B-123-ABC');
      expect(response.body.data.busModel).toBe('Mercedes Sprinter');
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.passengerCount).toBe(15);
      expect(response.body.data.totalSeats).toBe(50);
    });

    it('returns stops with serialized dates', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleRecord());
      mockBookingCount.mockResolvedValueOnce(0);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips/sched-1?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data.stops).toHaveLength(3);
      expect(response.body.data.stops[0].id).toBe('stop-1');
      expect(response.body.data.stops[0].stopName).toBe('Bucharest North');
      expect(response.body.data.stops[0].arrivalTime).toBe('2026-03-25T08:00:00.000Z');
      expect(response.body.data.stops[0].departureTime).toBe('2026-03-25T08:10:00.000Z');
      expect(response.body.data.stops[0].orderIndex).toBe(0);
      expect(response.body.data.stops[0].priceFromStart).toBe(0);
      expect(response.body.data.stops[2].stopName).toBe('Brasov');
      expect(response.body.data.stops[2].priceFromStart).toBe(50);
    });

    it('returns 200 with default date when date param omitted', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleRecord());
      mockBookingCount.mockResolvedValueOnce(0);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips/sched-1')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data.scheduleId).toBe('sched-1');
    });

    it('returns 404 when schedule does not exist', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips/nonexistent?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 when schedule is not assigned to this driver', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(
        makeScheduleRecord({ driverId: 'other-driver' }),
      );

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips/sched-1?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 403 when user is not a DRIVER', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PASSENGER_ID, status: 'ACTIVE' });

      const response = await supertest(app.server)
        .get('/api/v1/driver/trips/sched-1')
        .set('Authorization', PASSENGER_AUTH)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/driver/trips/sched-1')
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });
});
