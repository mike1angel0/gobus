import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockProviderCreate = vi.fn();
const mockRefreshTokenCreate = vi.fn();
const mockRefreshTokenFindUnique = vi.fn();
const mockBookingFindMany = vi.fn();
const mockBookingCount = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockScheduleCreate = vi.fn();
const mockScheduleFindMany = vi.fn();
const mockScheduleCount = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockBusFindUnique = vi.fn();
const mockStopTimeCreateMany = vi.fn();
const mockBookingSeatFindMany = vi.fn();
const mockBookingSeatCreateMany = vi.fn();
const mockBookingCreate = vi.fn();
const mockSeatFindMany = vi.fn();
const mockTransaction = vi.fn();
const mockAuditLogCreate = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    create: mockUserCreate,
    update: mockUserUpdate,
  },
  provider: { create: mockProviderCreate },
  refreshToken: {
    findUnique: mockRefreshTokenFindUnique,
    create: mockRefreshTokenCreate,
  },
  booking: {
    findMany: mockBookingFindMany,
    count: mockBookingCount,
    create: mockBookingCreate,
  },
  schedule: {
    findUnique: mockScheduleFindUnique,
    create: mockScheduleCreate,
    findMany: mockScheduleFindMany,
    count: mockScheduleCount,
  },
  route: { findUnique: mockRouteFindUnique },
  bus: { findUnique: mockBusFindUnique },
  stopTime: { createMany: mockStopTimeCreateMany },
  bookingSeat: { findMany: mockBookingSeatFindMany, createMany: mockBookingSeatCreateMany },
  seat: { findMany: mockSeatFindMany },
  auditLog: { create: mockAuditLogCreate },
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

const PASSENGER_AUTH = () =>
  createAuthHeader('user-pass-1', 'PASSENGER', { email: 'pass@test.com' });
const PROVIDER_AUTH = () =>
  createAuthHeader('user-prov-1', 'PROVIDER', { email: 'prov@test.com', providerId: 'prov-1' });

describe('Mass Assignment Prevention', () => {
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
    mockAuditLogCreate.mockResolvedValue({});
  });

  describe('Extra fields in request body → 400', () => {
    it('POST /api/v1/auth/register rejects unknown fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'newuser@test.com',
          password: 'Password1',
          name: 'New User',
          role: 'PASSENGER',
          extraField: 'injected',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('extraField') }),
        ]),
      );
    });

    it('POST /api/v1/auth/login rejects unknown fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@test.com',
          password: 'Password1',
          isAdmin: true,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/bookings rejects unknown fields', async () => {
      // Auth mock
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'user-pass-1',
        email: 'pass@test.com',
        role: 'PASSENGER',
        status: 'ACTIVE',
        providerId: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: { authorization: PASSENGER_AUTH() },
        payload: {
          scheduleId: 'sched-1',
          seatLabels: ['1A'],
          boardingStop: 'Stop A',
          alightingStop: 'Stop B',
          tripDate: '2025-06-01',
          totalPrice: 999.99,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('totalPrice') }),
        ]),
      );
    });

    it('POST /api/v1/buses rejects unknown fields', async () => {
      // Auth mock
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'user-prov-1',
        email: 'prov@test.com',
        role: 'PROVIDER',
        status: 'ACTIVE',
        providerId: 'prov-1',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/buses',
        headers: { authorization: PROVIDER_AUTH() },
        payload: {
          licensePlate: 'ABC-123',
          model: 'Mercedes',
          seats: [{ row: 1, column: 1, label: '1A', type: 'STANDARD', price: 10 }],
          providerId: 'injected-provider-id',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('PATCH /api/v1/auth/me rejects unknown fields', async () => {
      // Auth mock
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'user-pass-1',
        email: 'pass@test.com',
        role: 'PASSENGER',
        status: 'ACTIVE',
        providerId: null,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/auth/me',
        headers: { authorization: PASSENGER_AUTH() },
        payload: {
          name: 'Updated Name',
          role: 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('role') }),
        ]),
      );
    });
  });

  describe('Registration role whitelist', () => {
    it('role=ADMIN at registration → 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'admin@test.com',
          password: 'Password1',
          name: 'Admin Attempt',
          role: 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'role' })]),
      );
    });

    it('role=DRIVER at registration → 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'driver@test.com',
          password: 'Password1',
          name: 'Driver Attempt',
          role: 'DRIVER',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'role' })]),
      );
    });

    it('role=PASSENGER at registration → accepted', async () => {
      const createdUser = {
        id: 'user-new-1',
        email: 'passenger@test.com',
        name: 'Passenger',
        role: 'PASSENGER',
        phone: null,
        avatarUrl: null,
        preferences: null,
        providerId: null,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      // findUnique returns null (email not taken)
      mockUserFindUnique.mockResolvedValueOnce(null);
      // Transaction creates user + refresh token
      mockTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({
          user: { create: mockUserCreate },
          provider: { create: mockProviderCreate },
          refreshToken: { create: mockRefreshTokenCreate },
        });
      });
      mockUserCreate.mockResolvedValueOnce(createdUser);
      mockRefreshTokenCreate.mockResolvedValueOnce({ id: 'rt-1' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'passenger@test.com',
          password: 'Password1',
          name: 'Passenger',
          role: 'PASSENGER',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.user.role).toBe('PASSENGER');
    });
  });

  describe('Booking totalPrice is server-computed', () => {
    it('totalPrice in request body is rejected as unknown field', async () => {
      // Auth mock
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'user-pass-1',
        email: 'pass@test.com',
        role: 'PASSENGER',
        status: 'ACTIVE',
        providerId: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: { authorization: PASSENGER_AUTH() },
        payload: {
          scheduleId: 'sched-1',
          seatLabels: ['1A'],
          boardingStop: 'Stop A',
          alightingStop: 'Stop B',
          tripDate: '2025-06-01',
          totalPrice: 0.01,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('totalPrice') }),
        ]),
      );
    });
  });
});
