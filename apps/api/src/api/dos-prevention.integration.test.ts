import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockBookingCount = vi.fn();
const mockBookingFindMany = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingUpdate = vi.fn();
const mockBookingSeatFindMany = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockAuditLogCreate = vi.fn();

const mockPrisma = {
  user: { findUnique: mockUserFindUnique },
  booking: {
    findMany: mockBookingFindMany,
    findUnique: mockBookingFindUnique,
    create: mockBookingCreate,
    update: mockBookingUpdate,
    count: mockBookingCount,
  },
  bookingSeat: { findMany: mockBookingSeatFindMany },
  schedule: { findUnique: mockScheduleFindUnique },
  auditLog: { create: mockAuditLogCreate },
  $transaction: mockTransaction,
  $queryRawUnsafe: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
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

const USER_ID = 'user-1';
const AUTH_HEADER = createAuthHeader(USER_ID, 'PASSENGER');

describe('DoS and Resource Exhaustion Prevention', () => {
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
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, status: 'ACTIVE' });
    mockAuditLogCreate.mockResolvedValue({});
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
  });

  describe('oversized payload', () => {
    it('returns 413 for request body exceeding 1MB', async () => {
      const largePayload = 'x'.repeat(1_048_577); // Just over 1MB

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: {
          authorization: AUTH_HEADER,
          'content-type': 'application/json',
        },
        payload: largePayload,
      });

      expect(response.statusCode).toBe(413);
      const body = JSON.parse(response.body);
      expect(body.status).toBe(413);
      expect(body.title).toBe('Payload Too Large');
      expect(body.type).toBe('https://httpstatuses.com/413');
    });
  });

  describe('JSON nesting depth', () => {
    it('returns 400 for deeply nested JSON (>5 levels)', async () => {
      const deepPayload = { a: { b: { c: { d: { e: { f: 'too-deep' } } } } } };

      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .set('Content-Type', 'application/json')
        .send(deepPayload)
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.detail).toContain('nesting depth');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts JSON within depth limit (5 levels)', async () => {
      // 5 levels is fine — will fail for other reasons (validation), not depth
      const okPayload = { a: { b: { c: { d: { e: 'ok' } } } } };

      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .set('Content-Type', 'application/json')
        .send(okPayload);

      // Should NOT be 400 for depth — may fail on Zod validation instead
      expect(response.body.detail).not.toContain('nesting depth');
    });
  });

  describe('search minimum query length', () => {
    it('returns 400 for single-character origin', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/search?origin=a&destination=Bucharest&date=2026-03-25')
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for single-character destination', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/search?origin=Bucharest&destination=b&date=2026-03-25')
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('max active bookings per user', () => {
    it('returns 429 when user has 5 active bookings', async () => {
      mockBookingCount.mockResolvedValueOnce(5);

      const txClient = {
        schedule: { findUnique: mockScheduleFindUnique },
        bookingSeat: { findMany: mockBookingSeatFindMany },
        booking: { create: mockBookingCreate },
      };
      mockTransaction.mockImplementation(async (fn: (tx: typeof txClient) => Promise<unknown>) =>
        fn(txClient),
      );

      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .send({
          scheduleId: 'sched-1',
          seatLabels: ['1A'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj',
          tripDate: '2026-03-25',
        })
        .expect(429);

      expect(response.body.status).toBe(429);
      expect(response.body.code).toBe('RESOURCE_EXHAUSTED');
      expect(response.body.detail).toContain('Maximum 5 active bookings');
    });
  });

  describe('pagination enforcement', () => {
    it('rejects pageSize exceeding 100 on bookings endpoint', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/bookings?pageSize=10000')
        .set('Authorization', AUTH_HEADER)
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects pageSize exceeding 50 on search endpoint', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/search?origin=Bucharest&destination=Cluj&date=2026-03-25&pageSize=51')
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
