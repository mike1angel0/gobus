import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockProviderCreate = vi.fn();
const mockRefreshTokenFindUnique = vi.fn();
const mockRefreshTokenCreate = vi.fn();
const mockRefreshTokenUpdate = vi.fn();
const mockRefreshTokenUpdateMany = vi.fn();
const mockPasswordResetTokenCreate = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockTransaction = vi.fn();

// Booking mocks
const mockBookingFindUnique = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingUpdate = vi.fn();
const mockBookingCount = vi.fn();
const mockBookingSeatFindMany = vi.fn();
const mockBookingSeatCreateMany = vi.fn();
const mockBookingSeatDeleteMany = vi.fn();
const mockScheduleFindUnique = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    create: mockUserCreate,
    update: mockUserUpdate,
  },
  provider: {
    create: mockProviderCreate,
  },
  refreshToken: {
    findUnique: mockRefreshTokenFindUnique,
    create: mockRefreshTokenCreate,
    update: mockRefreshTokenUpdate,
    updateMany: mockRefreshTokenUpdateMany,
  },
  passwordResetToken: {
    create: mockPasswordResetTokenCreate,
  },
  auditLog: {
    create: mockAuditLogCreate,
  },
  booking: {
    findUnique: mockBookingFindUnique,
    create: mockBookingCreate,
    update: mockBookingUpdate,
    count: mockBookingCount,
  },
  bookingSeat: {
    findMany: mockBookingSeatFindMany,
    createMany: mockBookingSeatCreateMany,
    deleteMany: mockBookingSeatDeleteMany,
  },
  schedule: {
    findUnique: mockScheduleFindUnique,
  },
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

const PASSWORD_HASH = bcrypt.hashSync('Password1', 4);

function makeDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: PASSWORD_HASH,
    role: 'PASSENGER' as const,
    phone: null,
    avatarUrl: null,
    preferences: null,
    providerId: null,
    status: 'ACTIVE' as const,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Audit Logging Hooks', () => {
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
    // Default: handle array-style transactions (auth service uses $transaction([...]))
    mockTransaction.mockImplementation((actions: unknown) => {
      if (Array.isArray(actions)) return Promise.all(actions);
      return Promise.resolve();
    });
    mockAuditLogCreate.mockResolvedValue({});
  });

  // --- request.audit() helper ---
  describe('request.audit() helper', () => {
    it('is available on all requests', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      // Any route call exercises the audit decoration
      await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(401);

      // LOGIN_FAILURE audit should have been logged
      expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    });

    it('extracts IP address from x-forwarded-for header', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      await supertest(app.server)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.50, 70.41.3.18')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(401);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ipAddress: '203.0.113.50',
          }),
        }),
      );
    });

    it('captures user agent from request headers', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      await supertest(app.server)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'TestAgent/1.0')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(401);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userAgent: 'TestAgent/1.0',
          }),
        }),
      );
    });
  });

  // --- Auth events ---
  describe('Auth events', () => {
    it('logs REGISTER on successful registration', async () => {
      const newUser = makeDbUser({ id: 'new-user-1', email: 'new@example.com' });
      mockUserFindUnique.mockResolvedValueOnce(null);
      mockUserCreate.mockResolvedValueOnce(newUser);
      mockRefreshTokenCreate.mockResolvedValueOnce({});

      await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'new@example.com',
          password: 'StrongPass1',
          name: 'New User',
          role: 'PASSENGER',
        })
        .expect(201);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REGISTER',
            resource: 'user',
            resourceId: 'new-user-1',
          }),
        }),
      );
    });

    it('logs LOGIN_SUCCESS on successful login', async () => {
      const user = makeDbUser();
      mockUserFindUnique.mockResolvedValueOnce(user);
      mockRefreshTokenCreate.mockResolvedValueOnce({});

      await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(200);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN_SUCCESS',
            resource: 'user',
            resourceId: 'user-1',
          }),
        }),
      );
    });

    it('logs LOGIN_FAILURE on invalid credentials', async () => {
      const user = makeDbUser();
      mockUserFindUnique.mockResolvedValueOnce(user);
      mockUserUpdate.mockResolvedValueOnce(user);

      await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword1' })
        .expect(401);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN_FAILURE',
            resource: 'user',
          }),
        }),
      );
    });

    it('logs LOGIN_FAILURE when user not found', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password1' })
        .expect(401);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN_FAILURE',
            resource: 'user',
          }),
        }),
      );
    });

    it('logs LOGIN_LOCKED when account is locked', async () => {
      mockUserFindUnique.mockResolvedValueOnce(
        makeDbUser({
          status: 'LOCKED',
          lockedUntil: new Date(Date.now() + 60 * 60 * 1000),
        }),
      );

      await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(423);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN_LOCKED',
            resource: 'user',
          }),
        }),
      );
    });

    it('logs LOGOUT on successful logout', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
      mockRefreshTokenFindUnique.mockResolvedValueOnce({
        id: 'rt-1',
        token: 'hash',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      mockRefreshTokenUpdate.mockResolvedValueOnce({});

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      await supertest(app.server)
        .post('/api/v1/auth/logout')
        .set('Authorization', authHeader)
        .send({ refreshToken: 'some-refresh-token' })
        .expect(204);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGOUT',
            resource: 'user',
            resourceId: 'user-1',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('logs PASSWORD_RESET_REQUEST on forgot-password', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser());
      mockPasswordResetTokenCreate.mockResolvedValueOnce({});

      await supertest(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PASSWORD_RESET_REQUEST',
            resource: 'user',
          }),
        }),
      );
    });

    it('logs PASSWORD_CHANGE on successful password change', async () => {
      const user = makeDbUser();
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
      mockUserFindUnique.mockResolvedValueOnce(user);
      mockUserUpdate.mockResolvedValueOnce(user);
      mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 0 });

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      await supertest(app.server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', authHeader)
        .send({ currentPassword: 'Password1', newPassword: 'NewPassword1' })
        .expect(200);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PASSWORD_CHANGE',
            resource: 'user',
            resourceId: 'user-1',
            userId: 'user-1',
          }),
        }),
      );
    });
  });

  // --- Booking events ---
  describe('Booking events', () => {
    function makeBookingRecord(overrides: Record<string, unknown> = {}) {
      return {
        id: 'booking-1',
        orderId: 'ORD-001',
        userId: 'user-1',
        scheduleId: 'sched-1',
        totalPrice: 50,
        status: 'CONFIRMED',
        boardingStop: 'Stop A',
        alightingStop: 'Stop B',
        tripDate: new Date('2024-06-01'),
        createdAt: new Date('2024-01-01'),
        bookingSeats: [{ seatLabel: '1A' }],
        schedule: {
          departureTime: new Date('2024-06-01T08:00:00Z'),
          arrivalTime: new Date('2024-06-01T12:00:00Z'),
          route: {
            id: 'route-1',
            name: 'Route A-B',
            provider: { id: 'prov-1', name: 'Bus Co' },
          },
          bus: {
            id: 'bus-1',
            licensePlate: 'AB-123',
            model: 'Mercedes',
          },
        },
        ...overrides,
      };
    }

    function makeScheduleForCreate() {
      return {
        id: 'sched-1',
        stopTimes: [
          { stopName: 'Stop A', orderIndex: 0, priceFromStart: 0 },
          { stopName: 'Stop B', orderIndex: 1, priceFromStart: 50 },
        ],
        bus: {
          seats: [{ label: '1A', isEnabled: true, type: 'STANDARD' }],
        },
      };
    }

    it('logs BOOKING_CREATED on successful booking', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
      mockBookingCount.mockResolvedValueOnce(0);

      const createdBooking = makeBookingRecord();

      mockTransaction.mockImplementationOnce(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const txClient = {
            schedule: { findUnique: mockScheduleFindUnique },
            bookingSeat: { findMany: mockBookingSeatFindMany },
            booking: { create: mockBookingCreate },
          };
          mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleForCreate());
          mockBookingSeatFindMany.mockResolvedValueOnce([]);
          mockBookingCreate.mockResolvedValueOnce(createdBooking);
          return callback(txClient);
        },
      );

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', authHeader)
        .send({
          scheduleId: 'sched-1',
          tripDate: '2024-06-01',
          boardingStop: 'Stop A',
          alightingStop: 'Stop B',
          seatLabels: ['1A'],
        })
        .expect(201);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'BOOKING_CREATED',
            resource: 'booking',
            resourceId: 'booking-1',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('logs BOOKING_CANCELLED on successful cancellation', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });

      const booking = makeBookingRecord({ status: 'CONFIRMED' });
      const cancelledBooking = makeBookingRecord({ status: 'CANCELLED' });

      mockBookingFindUnique.mockResolvedValueOnce(booking);
      mockBookingUpdate.mockResolvedValueOnce(cancelledBooking);

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      await supertest(app.server)
        .delete('/api/v1/bookings/booking-1')
        .set('Authorization', authHeader)
        .expect(200);

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'BOOKING_CANCELLED',
            resource: 'booking',
            resourceId: 'booking-1',
            userId: 'user-1',
          }),
        }),
      );
    });
  });
});
