import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

import { createTestApp } from '@/test/helpers.js';

// --- Mock setup ---
const mockScheduleFindMany = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockBusFindMany = vi.fn();
const mockBusCount = vi.fn();
const mockBookingFindMany = vi.fn();
const mockBookingCount = vi.fn();
const mockTrackingFindFirst = vi.fn();
const mockDelayFindMany = vi.fn();
const mockDelayCount = vi.fn();
const mockScheduleCount = vi.fn();
const mockDriverFindMany = vi.fn();
const mockDriverCount = vi.fn();
const mockProviderFindUnique = vi.fn();
const mockRouteFindMany = vi.fn();
const mockRouteCount = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockRouteDelete = vi.fn();
const mockUserUpdate = vi.fn();
const mockRefreshTokenDeleteMany = vi.fn();
const mockAuditLogCreate = vi.fn();

const mockPrisma = {
  schedule: {
    findMany: mockScheduleFindMany,
    findUnique: mockScheduleFindUnique,
    count: mockScheduleCount,
  },
  user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
  bus: { findMany: mockBusFindMany, count: mockBusCount },
  booking: { findMany: mockBookingFindMany, count: mockBookingCount },
  busTracking: { findFirst: mockTrackingFindFirst, findUnique: mockTrackingFindFirst },
  delay: { findMany: mockDelayFindMany, count: mockDelayCount },
  driver: { findMany: mockDriverFindMany, count: mockDriverCount },
  provider: { findUnique: mockProviderFindUnique },
  route: { findMany: mockRouteFindMany, count: mockRouteCount, findUnique: mockRouteFindUnique, delete: mockRouteDelete },
  refreshToken: { deleteMany: mockRefreshTokenDeleteMany },
  auditLog: { create: mockAuditLogCreate },
  $queryRawUnsafe: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  $queryRaw: vi.fn().mockResolvedValue([]),
};

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: 'test-jwt-secret-do-not-use-in-prod',
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

const JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';

/** Generate a valid access token for testing. */
function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign({ ...payload, iss: 'transio-api', aud: 'transio-client' }, JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}

const passengerToken = makeToken({
  sub: 'user-1',
  role: 'PASSENGER',
  email: 'passenger@test.com',
});

const providerToken = makeToken({
  sub: 'provider-user-1',
  role: 'PROVIDER',
  email: 'provider@test.com',
  providerId: 'prov-1',
});

describe('Cache-Control Headers Integration', () => {
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
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    // Default auth mock — user lookup for authenticate decorator
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'passenger@test.com',
      role: 'PASSENGER',
      status: 'ACTIVE',
      name: 'Test',
      phone: null,
      avatarUrl: null,
      providerId: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('public endpoints with cachePublic', () => {
    it('GET /api/v1/search returns Cache-Control: public, max-age=30', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0n }]);

      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'AB', destination: 'CD', date: '2026-03-25' })
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=30');
    });

    it('GET /api/v1/trips/:scheduleId returns Cache-Control: public, max-age=10', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce({
        id: 'sched-1',
        status: 'ACTIVE',
        departureTime: new Date('2026-03-25T08:00:00Z'),
        arrivalTime: new Date('2026-03-25T12:00:00Z'),
        basePrice: 50,
        stopTimes: [
          {
            id: 'st-1',
            stopName: 'A',
            arrivalTime: new Date('2026-03-25T08:00:00Z'),
            departureTime: new Date('2026-03-25T08:10:00Z'),
            orderIndex: 0,
            priceFromStart: 0,
          },
        ],
        route: { name: 'Route 1', provider: { name: 'Provider 1' } },
        bus: { seats: [] },
        bookingSeats: [],
      });

      const response = await supertest(app.server)
        .get('/api/v1/trips/sched-1')
        .query({ tripDate: '2026-03-25' })
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=10');
    });
  });

  describe('tracking endpoint with noCache', () => {
    it('GET /api/v1/tracking/:busId returns Cache-Control: no-cache, no-store, must-revalidate', async () => {
      mockTrackingFindFirst.mockResolvedValueOnce({
        id: 'track-1',
        busId: 'bus-1',
        lat: 44.4,
        lng: 26.1,
        speed: 60,
        heading: 90,
        scheduleId: 'sched-1',
        currentStopIndex: 0,
        isActive: true,
        tripDate: new Date('2026-03-25'),
        updatedAt: new Date(),
      });

      const response = await supertest(app.server)
        .get('/api/v1/tracking/bus-1')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
    });
  });

  describe('authenticated endpoints with privateNoCache', () => {
    it('GET /api/v1/bookings returns Cache-Control: private, no-cache', async () => {
      mockBookingFindMany.mockResolvedValueOnce([]);
      mockBookingCount.mockResolvedValueOnce(0);

      const response = await supertest(app.server)
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('private, no-cache');
    });

    it('GET /api/v1/auth/me returns Cache-Control: private, no-cache', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${passengerToken}`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('private, no-cache');
    });

    it('GET /api/v1/buses returns Cache-Control: private, no-cache', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'provider-user-1',
        email: 'provider@test.com',
        role: 'PROVIDER',
        status: 'ACTIVE',
        name: 'Provider',
        phone: null,
        avatarUrl: null,
        providerId: 'prov-1',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockBusFindMany.mockResolvedValueOnce([]);
      mockBusCount.mockResolvedValueOnce(0);

      const response = await supertest(app.server)
        .get('/api/v1/buses')
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('private, no-cache');
    });

    it('GET /api/v1/routes returns Cache-Control: private, no-cache', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'provider-user-1',
        email: 'provider@test.com',
        role: 'PROVIDER',
        status: 'ACTIVE',
        name: 'Provider',
        phone: null,
        avatarUrl: null,
        providerId: 'prov-1',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRouteFindMany.mockResolvedValueOnce([]);
      mockRouteCount.mockResolvedValueOnce(0);

      const response = await supertest(app.server)
        .get('/api/v1/routes')
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('private, no-cache');
    });
  });

  describe('mutation endpoints with noCache (no-store)', () => {
    it('POST /api/v1/auth/register returns Cache-Control: no-cache, no-store, must-revalidate', async () => {
      // Will fail validation but cache header is set in preHandler before handler executes
      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({ email: 'x', password: 'y' });

      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
    });

    it('DELETE /api/v1/routes/:id returns Cache-Control: no-cache, no-store, must-revalidate', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'provider-user-1',
        email: 'provider@test.com',
        role: 'PROVIDER',
        status: 'ACTIVE',
        name: 'Provider',
        phone: null,
        avatarUrl: null,
        providerId: 'prov-1',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRouteFindUnique.mockResolvedValueOnce({
        id: 'route-1',
        providerId: 'prov-1',
        name: 'Test Route',
        createdAt: new Date(),
        schedules: [],
      });
      mockRouteDelete.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .delete('/api/v1/routes/route-1')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
    });

    it('PATCH /api/v1/auth/me returns Cache-Control: no-cache, no-store, must-revalidate', async () => {
      mockUserUpdate.mockResolvedValueOnce({
        id: 'user-1',
        email: 'passenger@test.com',
        role: 'PASSENGER',
        status: 'ACTIVE',
        name: 'Updated',
        phone: null,
        avatarUrl: null,
        providerId: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await supertest(app.server)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ name: 'Updated' });

      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
    });
  });

  describe('bus templates with cachePublic(3600)', () => {
    it('GET /api/v1/buses/templates returns Cache-Control: public, max-age=3600', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'provider-user-1',
        email: 'provider@test.com',
        role: 'PROVIDER',
        status: 'ACTIVE',
        name: 'Provider',
        phone: null,
        avatarUrl: null,
        providerId: 'prov-1',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await supertest(app.server)
        .get('/api/v1/buses/templates')
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=3600');
    });
  });
});
