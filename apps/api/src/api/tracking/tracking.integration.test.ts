import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

// --- Mock setup ---
const mockBusTrackingFindUnique = vi.fn();
const mockBusTrackingUpsert = vi.fn();
const mockBusFindUnique = vi.fn();
const mockScheduleFindFirst = vi.fn();
const mockUserFindUnique = vi.fn();

const mockPrisma = {
  busTracking: {
    findUnique: mockBusTrackingFindUnique,
    upsert: mockBusTrackingUpsert,
  },
  bus: {
    findUnique: mockBusFindUnique,
  },
  schedule: {
    findFirst: mockScheduleFindFirst,
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
const DRIVER_AUTH = createAuthHeader(DRIVER_ID, 'DRIVER');
const PASSENGER_AUTH = createAuthHeader(PASSENGER_ID, 'PASSENGER');

function makeTrackingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tracking-1',
    busId: 'bus-1',
    lat: 44.4268,
    lng: 26.1025,
    speed: 60,
    heading: 90,
    scheduleId: 'sched-1',
    currentStopIndex: 2,
    isActive: true,
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    updatedAt: new Date('2026-03-25T10:30:00.000Z'),
    ...overrides,
  };
}

describe('Tracking Routes', () => {
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

  // --- GET /api/v1/tracking/:busId ---
  describe('GET /api/v1/tracking/:busId', () => {
    it('returns 200 with tracking data when active tracking exists', async () => {
      mockBusTrackingFindUnique.mockResolvedValueOnce(makeTrackingRecord());

      const response = await supertest(app.server)
        .get('/api/v1/tracking/bus-1')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data.id).toBe('tracking-1');
      expect(response.body.data.busId).toBe('bus-1');
      expect(response.body.data.lat).toBe(44.4268);
      expect(response.body.data.lng).toBe(26.1025);
      expect(response.body.data.speed).toBe(60);
      expect(response.body.data.heading).toBe(90);
      expect(response.body.data.scheduleId).toBe('sched-1');
      expect(response.body.data.currentStopIndex).toBe(2);
      expect(response.body.data.isActive).toBe(true);
      expect(response.body.data.tripDate).toBe('2026-03-25');
      expect(response.body.data.updatedAt).toBe('2026-03-25T10:30:00.000Z');
    });

    it('returns 404 when no tracking data exists for bus', async () => {
      mockBusTrackingFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .get('/api/v1/tracking/bus-999')
        .set('Authorization', DRIVER_AUTH)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 200 with null tripDate and scheduleId when not set', async () => {
      mockBusTrackingFindUnique.mockResolvedValueOnce(
        makeTrackingRecord({ tripDate: null, scheduleId: null }),
      );

      const response = await supertest(app.server)
        .get('/api/v1/tracking/bus-1')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      expect(response.body.data.tripDate).toBeNull();
      expect(response.body.data.scheduleId).toBeNull();
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/tracking/bus-1').expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- POST /api/v1/tracking ---
  describe('POST /api/v1/tracking', () => {
    const validBody = {
      busId: 'bus-1',
      lat: 44.4268,
      lng: 26.1025,
      speed: 60,
      heading: 90,
      currentStopIndex: 2,
    };

    it('returns 200 with tracking data on successful update', async () => {
      mockBusFindUnique.mockResolvedValueOnce({ id: 'bus-1' });
      mockScheduleFindFirst.mockResolvedValueOnce({ id: 'sched-1' });
      mockBusTrackingUpsert.mockResolvedValueOnce(makeTrackingRecord());

      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', DRIVER_AUTH)
        .send(validBody)
        .expect(200);

      expect(response.body.data.id).toBe('tracking-1');
      expect(response.body.data.busId).toBe('bus-1');
      expect(response.body.data.lat).toBe(44.4268);
      expect(response.body.data.lng).toBe(26.1025);
      expect(response.body.data.speed).toBe(60);
      expect(response.body.data.heading).toBe(90);
      expect(response.body.data.isActive).toBe(true);
    });

    it('returns 200 with optional scheduleId and tripDate', async () => {
      mockBusFindUnique.mockResolvedValueOnce({ id: 'bus-1' });
      mockScheduleFindFirst.mockResolvedValueOnce({ id: 'sched-1' });
      mockBusTrackingUpsert.mockResolvedValueOnce(makeTrackingRecord());

      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', DRIVER_AUTH)
        .send({ ...validBody, scheduleId: 'sched-1', tripDate: '2026-03-25' })
        .expect(200);

      expect(response.body.data.scheduleId).toBe('sched-1');
    });

    it('returns 403 when user is not a DRIVER', async () => {
      mockUserFindUnique.mockResolvedValue({ id: PASSENGER_ID, status: 'ACTIVE' });

      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', PASSENGER_AUTH)
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 403 when driver is not assigned to bus', async () => {
      mockBusFindUnique.mockResolvedValueOnce({ id: 'bus-1' });
      mockScheduleFindFirst.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', DRIVER_AUTH)
        .send(validBody)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 404 when bus does not exist', async () => {
      mockBusFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', DRIVER_AUTH)
        .send({ ...validBody, busId: 'nonexistent' })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 400 when body is missing required fields', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', DRIVER_AUTH)
        .send({ busId: 'bus-1' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when lat is out of range', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', DRIVER_AUTH)
        .send({ ...validBody, lat: 91 })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when unknown fields are present (strict parsing)', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .set('Authorization', DRIVER_AUTH)
        .send({ ...validBody, unknownField: 'test' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/tracking')
        .send(validBody)
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });
});
