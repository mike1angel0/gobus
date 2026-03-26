import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';
import { createSpecValidator } from '@/test/openapi-validator.js';

// ---------------------------------------------------------------------------
// Mock declarations
// ---------------------------------------------------------------------------
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockProviderCreate = vi.fn();
const mockRefreshTokenFindUnique = vi.fn();
const mockRefreshTokenCreate = vi.fn();
const mockRefreshTokenUpdate = vi.fn();
const mockRefreshTokenUpdateMany = vi.fn();
const mockPasswordResetTokenCreate = vi.fn();
const mockRouteFindMany = vi.fn();
const mockRouteCount = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockBusFindMany = vi.fn();
const mockBusCount = vi.fn();
const mockBusFindUnique = vi.fn();
const mockScheduleFindMany = vi.fn();
const mockScheduleCount = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockBookingFindMany = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockBookingCount = vi.fn();
const mockBusTrackingFindUnique = vi.fn();
const mockDelayFindMany = vi.fn();
const mockDelayCount = vi.fn();
const mockSeatFindUnique = vi.fn();
const mockSeatUpdate = vi.fn();
const mockAuditLogFindMany = vi.fn();
const mockAuditLogCount = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    create: mockUserCreate,
    update: mockUserUpdate,
    findMany: mockUserFindMany,
    count: mockUserCount,
  },
  provider: {
    create: mockProviderCreate,
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    findUnique: mockRefreshTokenFindUnique,
    create: mockRefreshTokenCreate,
    update: mockRefreshTokenUpdate,
    updateMany: mockRefreshTokenUpdateMany,
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    create: mockPasswordResetTokenCreate,
    update: vi.fn(),
  },
  route: {
    findMany: mockRouteFindMany,
    count: mockRouteCount,
    findUnique: mockRouteFindUnique,
    delete: vi.fn(),
    create: vi.fn(),
  },
  bus: {
    findMany: mockBusFindMany,
    count: mockBusCount,
    findUnique: mockBusFindUnique,
    delete: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  seat: { findUnique: mockSeatFindUnique, update: mockSeatUpdate },
  schedule: {
    findMany: mockScheduleFindMany,
    count: mockScheduleCount,
    findUnique: mockScheduleFindUnique,
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  booking: {
    findMany: mockBookingFindMany,
    findUnique: mockBookingFindUnique,
    create: vi.fn(),
    update: vi.fn(),
    count: mockBookingCount,
  },
  bookingSeat: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  busTracking: { findUnique: mockBusTrackingFindUnique, upsert: vi.fn() },
  delay: {
    findMany: mockDelayFindMany,
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: mockDelayCount,
  },
  auditLog: {
    findMany: mockAuditLogFindMany,
    count: mockAuditLogCount,
    create: mockAuditLogCreate,
  },
  $transaction: mockTransaction,
  $queryRawUnsafe: mockQueryRawUnsafe,
  $queryRaw: vi.fn(),
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

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
const PROVIDER_AUTH = createAuthHeader('user-1', 'PROVIDER', {
  email: 'p@test.com',
  providerId: 'prov-1',
});
const PASSENGER_AUTH = createAuthHeader('pass-1', 'PASSENGER', { email: 'u@test.com' });
const DRIVER_AUTH = createAuthHeader('drv-1', 'DRIVER', {
  email: 'd@test.com',
  providerId: 'prov-1',
});
const ADMIN_AUTH = createAuthHeader('adm-1', 'ADMIN', { email: 'a@test.com' });

function authProvider() {
  mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
}
function authPassenger() {
  mockUserFindUnique.mockResolvedValueOnce({ id: 'pass-1', status: 'ACTIVE' });
}
function authDriver() {
  mockUserFindUnique.mockResolvedValueOnce({ id: 'drv-1', status: 'ACTIVE' });
}
function authAdmin() {
  mockUserFindUnique.mockResolvedValueOnce({
    id: 'adm-1',
    email: 'a@test.com',
    name: 'Admin',
    role: 'ADMIN',
    phone: null,
    avatarUrl: null,
    providerId: null,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  });
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------
const NOW = new Date('2026-03-25T10:00:00.000Z');
const PASSWORD_HASH = bcrypt.hashSync('Password1!', 4);

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: PASSWORD_HASH,
    role: 'PASSENGER' as const,
    phone: null,
    avatarUrl: null,
    preferences: {},
    providerId: null,
    status: 'ACTIVE' as const,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRoute(overrides = {}) {
  return {
    id: 'route-1',
    name: 'Bucharest - Cluj',
    providerId: 'prov-1',
    createdAt: NOW,
    ...overrides,
  };
}

function makeRouteWithStops(overrides = {}) {
  return {
    ...makeRoute(overrides),
    stops: [
      {
        id: 'stop-1',
        name: 'Bucharest',
        lat: 44.4268,
        lng: 26.1025,
        orderIndex: 0,
        routeId: 'route-1',
      },
      { id: 'stop-2', name: 'Cluj', lat: 46.7712, lng: 23.6236, orderIndex: 1, routeId: 'route-1' },
    ],
  };
}

function makeBus(overrides = {}) {
  return {
    id: 'bus-1',
    licensePlate: 'B-123-ABC',
    model: 'Mercedes Tourismo',
    capacity: 52,
    rows: 13,
    columns: 4,
    providerId: 'prov-1',
    createdAt: NOW,
    ...overrides,
  };
}

function makeBusWithSeats(overrides = {}) {
  return {
    ...makeBus(overrides),
    seats: [
      {
        id: 'seat-1',
        row: 1,
        column: 1,
        label: '1A',
        type: 'STANDARD',
        price: 0,
        isEnabled: true,
        busId: 'bus-1',
      },
    ],
  };
}

function makeSchedule(overrides = {}) {
  return {
    id: 'sched-1',
    routeId: 'route-1',
    busId: 'bus-1',
    driverId: 'drv-1',
    departureTime: NOW,
    arrivalTime: new Date('2026-03-25T14:00:00.000Z'),
    daysOfWeek: [1, 3, 5],
    basePrice: 50,
    status: 'ACTIVE',
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    createdAt: NOW,
    ...overrides,
  };
}

function makeScheduleWithDetails(overrides = {}) {
  return {
    ...makeSchedule(overrides),
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: NOW,
        departureTime: new Date('2026-03-25T10:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
        lat: 44.4268,
        lng: 26.1025,
      },
      {
        id: 'st-2',
        stopName: 'Cluj',
        arrivalTime: new Date('2026-03-25T13:50:00.000Z'),
        departureTime: new Date('2026-03-25T14:00:00.000Z'),
        orderIndex: 1,
        priceFromStart: 50,
        lat: 46.7712,
        lng: 23.6236,
      },
    ],
    route: { id: 'route-1', name: 'Bucharest - Cluj', providerId: 'prov-1', createdAt: NOW },
    bus: {
      id: 'bus-1',
      licensePlate: 'B-123-ABC',
      model: 'Mercedes Tourismo',
      capacity: 52,
      rows: 13,
      columns: 4,
      providerId: 'prov-1',
      createdAt: NOW,
    },
    driver: { id: 'drv-1', name: 'Ion Popescu' },
  };
}

function makeBooking(overrides = {}) {
  return {
    id: 'book-1',
    orderId: 'ORD-123',
    userId: 'pass-1',
    scheduleId: 'sched-1',
    totalPrice: 50,
    status: 'CONFIRMED',
    boardingStop: 'Bucharest',
    alightingStop: 'Cluj',
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    createdAt: NOW,
    bookingSeats: [{ seatLabel: '1A' }],
    schedule: {
      departureTime: NOW,
      arrivalTime: new Date('2026-03-25T14:00:00.000Z'),
      route: {
        id: 'route-1',
        name: 'Bucharest - Cluj',
        provider: { id: 'prov-1', name: 'FlixBus' },
      },
      bus: { id: 'bus-1', licensePlate: 'B-123-ABC', model: 'Mercedes Tourismo' },
    },
    ...overrides,
  };
}

function makeSearchSchedule() {
  return {
    id: 'sched-1',
    status: 'ACTIVE',
    departureTime: NOW,
    arrivalTime: new Date('2026-03-25T14:00:00.000Z'),
    basePrice: 50,
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: NOW,
        departureTime: new Date('2026-03-25T10:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
        lat: 44.4268,
        lng: 26.1025,
      },
      {
        id: 'st-2',
        stopName: 'Cluj',
        arrivalTime: new Date('2026-03-25T13:50:00.000Z'),
        departureTime: new Date('2026-03-25T14:00:00.000Z'),
        orderIndex: 1,
        priceFromStart: 50,
        lat: 46.7712,
        lng: 23.6236,
      },
    ],
    route: { name: 'Bucharest - Cluj', provider: { name: 'FlixBus' } },
    bus: {
      seats: [
        { id: 'seat-1', isEnabled: true, type: 'STANDARD' },
        { id: 'seat-2', isEnabled: true, type: 'STANDARD' },
      ],
    },
    bookingSeats: [],
    delays: [],
  };
}

function makeTripSchedule() {
  return {
    id: 'sched-1',
    status: 'ACTIVE',
    departureTime: NOW,
    arrivalTime: new Date('2026-03-25T14:00:00.000Z'),
    basePrice: 50,
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: NOW,
        departureTime: new Date('2026-03-25T10:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
        lat: 44.4268,
        lng: 26.1025,
      },
      {
        id: 'st-2',
        stopName: 'Cluj',
        arrivalTime: new Date('2026-03-25T13:50:00.000Z'),
        departureTime: new Date('2026-03-25T14:00:00.000Z'),
        orderIndex: 1,
        priceFromStart: 50,
        lat: 46.7712,
        lng: 23.6236,
      },
    ],
    route: { name: 'Bucharest - Cluj', provider: { name: 'FlixBus' } },
    bus: {
      seats: [
        {
          id: 'seat-1',
          row: 1,
          column: 1,
          label: '1A',
          type: 'STANDARD',
          price: 0,
          isEnabled: true,
        },
        {
          id: 'seat-2',
          row: 1,
          column: 2,
          label: '1B',
          type: 'STANDARD',
          price: 0,
          isEnabled: true,
        },
      ],
    },
    bookingSeats: [],
    delays: [],
  };
}

function makeTracking(overrides = {}) {
  return {
    id: 'track-1',
    busId: 'bus-1',
    lat: 44.4268,
    lng: 26.1025,
    speed: 60,
    heading: 90,
    scheduleId: 'sched-1',
    currentStopIndex: 1,
    isActive: true,
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDelay(overrides = {}) {
  return {
    id: 'delay-1',
    scheduleId: 'sched-1',
    offsetMinutes: 15,
    reason: 'TRAFFIC',
    note: null,
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    active: true,
    createdAt: NOW,
    ...overrides,
  };
}

function makeAdminUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Test User',
    role: 'PASSENGER',
    phone: null,
    avatarUrl: null,
    providerId: null,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeAuditLog(overrides = {}) {
  return {
    id: 'audit-1',
    userId: 'user-1',
    action: 'LOGIN_SUCCESS',
    resource: 'auth',
    resourceId: null,
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    metadata: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeDriverTrip(overrides = {}) {
  return {
    ...makeSchedule(overrides),
    route: { name: 'Bucharest - Cluj' },
    bus: { id: 'bus-1', licensePlate: 'B-123-ABC', model: 'Mercedes Tourismo', capacity: 52 },
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: NOW,
        departureTime: new Date('2026-03-25T10:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
        lat: 44.4268,
        lng: 26.1025,
      },
      {
        id: 'st-2',
        stopName: 'Cluj',
        arrivalTime: new Date('2026-03-25T13:50:00.000Z'),
        departureTime: new Date('2026-03-25T14:00:00.000Z'),
        orderIndex: 1,
        priceFromStart: 50,
        lat: 46.7712,
        lng: 23.6236,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Helper: assert conformance
// ---------------------------------------------------------------------------
function assertConforms(
  validator: ReturnType<typeof createSpecValidator>,
  specPath: string,
  method: string,
  statusCode: number,
  body: unknown,
) {
  const result = validator.validate(specPath, method, statusCode, body);
  if (!result.valid) {
    expect.fail(
      `${method.toUpperCase()} ${specPath} → ${statusCode} does not conform to spec:\n` +
        result.errors.map((e) => `  - ${e}`).join('\n'),
    );
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('API Spec Conformance', () => {
  let app: FastifyInstance;
  let validator: ReturnType<typeof createSpecValidator>;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
    validator = createSpecValidator();
  });

  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 401 Error Response — validates ErrorResponse schema for all protected endpoints
  // -----------------------------------------------------------------------
  describe('401 Error Response Conformance', () => {
    const protectedEndpoints: Array<{ method: string; path: string; specPath: string }> = [
      { method: 'post', path: '/api/v1/auth/logout', specPath: '/api/v1/auth/logout' },
      {
        method: 'post',
        path: '/api/v1/auth/change-password',
        specPath: '/api/v1/auth/change-password',
      },
      { method: 'get', path: '/api/v1/auth/me', specPath: '/api/v1/auth/me' },
      { method: 'patch', path: '/api/v1/auth/me', specPath: '/api/v1/auth/me' },
      { method: 'get', path: '/api/v1/providers/me', specPath: '/api/v1/providers/me' },
      { method: 'get', path: '/api/v1/routes', specPath: '/api/v1/routes' },
      { method: 'post', path: '/api/v1/routes', specPath: '/api/v1/routes' },
      { method: 'get', path: '/api/v1/routes/route-1', specPath: '/api/v1/routes/{id}' },
      { method: 'delete', path: '/api/v1/routes/route-1', specPath: '/api/v1/routes/{id}' },
      { method: 'get', path: '/api/v1/buses', specPath: '/api/v1/buses' },
      { method: 'post', path: '/api/v1/buses', specPath: '/api/v1/buses' },
      { method: 'get', path: '/api/v1/buses/bus-1', specPath: '/api/v1/buses/{id}' },
      { method: 'put', path: '/api/v1/buses/bus-1', specPath: '/api/v1/buses/{id}' },
      { method: 'delete', path: '/api/v1/buses/bus-1', specPath: '/api/v1/buses/{id}' },
      { method: 'get', path: '/api/v1/buses/templates', specPath: '/api/v1/buses/templates' },
      { method: 'get', path: '/api/v1/drivers', specPath: '/api/v1/drivers' },
      { method: 'post', path: '/api/v1/drivers', specPath: '/api/v1/drivers' },
      { method: 'delete', path: '/api/v1/drivers/drv-1', specPath: '/api/v1/drivers/{id}' },
      { method: 'get', path: '/api/v1/schedules', specPath: '/api/v1/schedules' },
      { method: 'post', path: '/api/v1/schedules', specPath: '/api/v1/schedules' },
      { method: 'get', path: '/api/v1/schedules/sched-1', specPath: '/api/v1/schedules/{id}' },
      { method: 'put', path: '/api/v1/schedules/sched-1', specPath: '/api/v1/schedules/{id}' },
      { method: 'delete', path: '/api/v1/schedules/sched-1', specPath: '/api/v1/schedules/{id}' },
      { method: 'get', path: '/api/v1/bookings', specPath: '/api/v1/bookings' },
      { method: 'post', path: '/api/v1/bookings', specPath: '/api/v1/bookings' },
      { method: 'get', path: '/api/v1/bookings/book-1', specPath: '/api/v1/bookings/{id}' },
      { method: 'delete', path: '/api/v1/bookings/book-1', specPath: '/api/v1/bookings/{id}' },
      { method: 'get', path: '/api/v1/tracking/bus-1', specPath: '/api/v1/tracking/{busId}' },
      { method: 'post', path: '/api/v1/tracking', specPath: '/api/v1/tracking' },
      { method: 'get', path: '/api/v1/driver/trips', specPath: '/api/v1/driver/trips' },
      {
        method: 'get',
        path: '/api/v1/driver/trips/sched-1',
        specPath: '/api/v1/driver/trips/{scheduleId}',
      },
      { method: 'get', path: '/api/v1/delays', specPath: '/api/v1/delays' },
      { method: 'post', path: '/api/v1/delays', specPath: '/api/v1/delays' },
      { method: 'put', path: '/api/v1/delays/delay-1', specPath: '/api/v1/delays/{id}' },
      { method: 'get', path: '/api/v1/admin/buses', specPath: '/api/v1/admin/buses' },
      { method: 'get', path: '/api/v1/admin/users', specPath: '/api/v1/admin/users' },
      {
        method: 'patch',
        path: '/api/v1/admin/users/user-1/status',
        specPath: '/api/v1/admin/users/{id}/status',
      },
      {
        method: 'delete',
        path: '/api/v1/admin/users/user-1/sessions',
        specPath: '/api/v1/admin/users/{id}/sessions',
      },
      { method: 'get', path: '/api/v1/admin/audit-logs', specPath: '/api/v1/admin/audit-logs' },
      { method: 'patch', path: '/api/v1/admin/seats/seat-1', specPath: '/api/v1/admin/seats/{id}' },
    ];

    it.each(protectedEndpoints)(
      '$method $path → 401 conforms to ErrorResponse',
      async ({ method, path, specPath }) => {
        const req = supertest(app.server)[method as 'get' | 'post' | 'put' | 'patch' | 'delete'](
          path,
        );
        const res = await req.expect(401);
        assertConforms(validator, specPath, method, 401, res.body);
      },
    );
  });

  // -----------------------------------------------------------------------
  // Auth success responses
  // -----------------------------------------------------------------------
  describe('Auth success responses', () => {
    it('POST /auth/login → 200 conforms to spec', async () => {
      const user = makeUser();
      mockUserFindUnique.mockResolvedValueOnce(user);
      mockUserUpdate.mockResolvedValueOnce(user);
      mockRefreshTokenCreate.mockResolvedValueOnce({ id: 'rt-1' });
      mockAuditLogCreate.mockResolvedValueOnce({});

      const res = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password1!' })
        .expect(200);

      assertConforms(validator, '/api/v1/auth/login', 'post', 200, res.body);
    });

    it('POST /auth/refresh → 200 conforms to spec', async () => {
      const { createHash, randomBytes } = await import('node:crypto');
      const rawToken = randomBytes(40).toString('hex');
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      mockRefreshTokenFindUnique.mockResolvedValueOnce({
        id: 'rt-1',
        token: hashedToken,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        revoked: false,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'PASSENGER',
          providerId: null,
          status: 'ACTIVE',
        },
      });
      mockRefreshTokenUpdate.mockResolvedValueOnce({});
      mockRefreshTokenCreate.mockResolvedValueOnce({ id: 'rt-2' });

      const res = await supertest(app.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawToken })
        .expect(200);

      assertConforms(validator, '/api/v1/auth/refresh', 'post', 200, res.body);
    });

    it('POST /auth/forgot-password → 200 conforms to spec', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      const res = await supertest(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      assertConforms(validator, '/api/v1/auth/forgot-password', 'post', 200, res.body);
    });

    it('GET /auth/me → 200 conforms to spec', async () => {
      const user = makeUser({ id: 'pass-1' });
      authPassenger();
      mockUserFindUnique.mockResolvedValueOnce(user);

      const res = await supertest(app.server)
        .get('/api/v1/auth/me')
        .set('Authorization', PASSENGER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/auth/me', 'get', 200, res.body);
    });
  });

  // -----------------------------------------------------------------------
  // Provider success responses
  // -----------------------------------------------------------------------
  describe('Provider success responses', () => {
    it('GET /providers/me → 200 conforms to spec', async () => {
      authProvider();
      mockUserFindUnique.mockResolvedValueOnce({
        provider: {
          id: 'prov-1',
          name: 'FlixBus',
          logo: null,
          contactEmail: 'contact@flixbus.com',
          contactPhone: '+40700000000',
          status: 'APPROVED',
          createdAt: NOW,
          updatedAt: NOW,
        },
      });

      const res = await supertest(app.server)
        .get('/api/v1/providers/me')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/providers/me', 'get', 200, res.body);
    });
  });

  // -----------------------------------------------------------------------
  // Resource GET success responses
  // -----------------------------------------------------------------------
  describe('Resource GET success responses', () => {
    it('GET /routes → 200 conforms to spec', async () => {
      authProvider();
      mockRouteFindMany.mockResolvedValueOnce([makeRoute()]);
      mockRouteCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/routes')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/routes', 'get', 200, res.body);
    });

    it('GET /routes/:id → 200 conforms to spec', async () => {
      authProvider();
      mockRouteFindUnique.mockResolvedValueOnce(makeRouteWithStops());

      const res = await supertest(app.server)
        .get('/api/v1/routes/route-1')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/routes/{id}', 'get', 200, res.body);
    });

    it('GET /buses → 200 conforms to spec', async () => {
      authProvider();
      mockBusFindMany.mockResolvedValueOnce([makeBus()]);
      mockBusCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/buses')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/buses', 'get', 200, res.body);
    });

    it('GET /buses/:id → 200 conforms to spec', async () => {
      authProvider();
      mockBusFindUnique.mockResolvedValueOnce(makeBusWithSeats());

      const res = await supertest(app.server)
        .get('/api/v1/buses/bus-1')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/buses/{id}', 'get', 200, res.body);
    });

    it('GET /buses/templates → 200 conforms to spec', async () => {
      authProvider();

      const res = await supertest(app.server)
        .get('/api/v1/buses/templates')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/buses/templates', 'get', 200, res.body);
    });

    it('GET /drivers → 200 conforms to spec', async () => {
      authProvider();
      mockUserFindMany.mockResolvedValueOnce([
        {
          id: 'drv-1',
          email: 'driver@test.com',
          name: 'Driver One',
          role: 'DRIVER',
          phone: '+40712345678',
          status: 'ACTIVE',
          providerId: 'prov-1',
          createdAt: NOW,
          updatedAt: NOW,
          _count: { driverSchedules: 3 },
        },
      ]);
      mockUserCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/drivers')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/drivers', 'get', 200, res.body);
    });

    it('GET /schedules → 200 conforms to spec', async () => {
      authProvider();
      mockScheduleFindMany.mockResolvedValueOnce([makeSchedule()]);
      mockScheduleCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/schedules')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/schedules', 'get', 200, res.body);
    });

    it('GET /schedules/:id → 200 conforms to spec', async () => {
      authProvider();
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleWithDetails());

      const res = await supertest(app.server)
        .get('/api/v1/schedules/sched-1')
        .set('Authorization', PROVIDER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/schedules/{id}', 'get', 200, res.body);
    });
  });

  // -----------------------------------------------------------------------
  // Public endpoint success responses
  // -----------------------------------------------------------------------
  describe('Public endpoint success responses', () => {
    it('GET /search → 200 conforms to spec', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: 1n }])
        .mockResolvedValueOnce([{ id: 'sched-1' }]);
      mockScheduleFindMany.mockResolvedValueOnce([makeSearchSchedule()]);

      const res = await supertest(app.server)
        .get('/api/v1/search?origin=Bucharest&destination=Cluj&date=2026-03-25')
        .expect(200);

      assertConforms(validator, '/api/v1/search', 'get', 200, res.body);
    });

    it('GET /trips/:scheduleId → 200 conforms to spec', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(makeTripSchedule());

      const res = await supertest(app.server)
        .get('/api/v1/trips/sched-1?tripDate=2026-03-25')
        .expect(200);

      assertConforms(validator, '/api/v1/trips/{scheduleId}', 'get', 200, res.body);
    });
  });

  // -----------------------------------------------------------------------
  // Booking success responses
  // -----------------------------------------------------------------------
  describe('Booking success responses', () => {
    it('GET /bookings → 200 conforms to spec', async () => {
      authPassenger();
      mockBookingFindMany.mockResolvedValueOnce([makeBooking()]);
      mockBookingCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/bookings')
        .set('Authorization', PASSENGER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/bookings', 'get', 200, res.body);
    });

    it('GET /bookings/:id → 200 conforms to spec', async () => {
      authPassenger();
      mockBookingFindUnique.mockResolvedValueOnce(makeBooking());

      const res = await supertest(app.server)
        .get('/api/v1/bookings/book-1')
        .set('Authorization', PASSENGER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/bookings/{id}', 'get', 200, res.body);
    });
  });

  // -----------------------------------------------------------------------
  // Driver endpoint success responses
  // -----------------------------------------------------------------------
  describe('Driver endpoint success responses', () => {
    it('GET /driver/trips → 200 conforms to spec', async () => {
      authDriver();
      mockScheduleFindMany.mockResolvedValueOnce([makeDriverTrip()]);
      mockScheduleCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/driver/trips?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/driver/trips', 'get', 200, res.body);
    });

    it('GET /driver/trips/:scheduleId → 200 conforms to spec', async () => {
      authDriver();
      mockScheduleFindUnique.mockResolvedValueOnce({
        ...makeDriverTrip({ driverId: 'drv-1' }),
        bookingSeats: [
          {
            seatLabel: '1A',
            booking: {
              id: 'book-1',
              boardingStop: 'Bucharest',
              alightingStop: 'Cluj',
              status: 'CONFIRMED',
              user: { name: 'Test', phone: '+40700000000' },
            },
          },
        ],
      });
      mockBookingCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/driver/trips/sched-1?date=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/driver/trips/{scheduleId}', 'get', 200, res.body);
    });

    it('GET /delays → 200 conforms to spec', async () => {
      authDriver();
      mockDelayFindMany.mockResolvedValueOnce([makeDelay()]);
      mockDelayCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/delays?scheduleId=sched-1&tripDate=2026-03-25')
        .set('Authorization', DRIVER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/delays', 'get', 200, res.body);
    });
  });

  // -----------------------------------------------------------------------
  // Tracking success responses
  // -----------------------------------------------------------------------
  describe('Tracking success responses', () => {
    it('GET /tracking/:busId → 200 conforms to spec', async () => {
      authPassenger();
      mockBusTrackingFindUnique.mockResolvedValueOnce(makeTracking());

      const res = await supertest(app.server)
        .get('/api/v1/tracking/bus-1')
        .set('Authorization', PASSENGER_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/tracking/{busId}', 'get', 200, res.body);
    });
  });

  // -----------------------------------------------------------------------
  // Admin success responses
  // -----------------------------------------------------------------------
  describe('Admin success responses', () => {
    it('GET /admin/users → 200 conforms to spec', async () => {
      authAdmin();
      mockUserFindMany.mockResolvedValueOnce([makeAdminUser()]);
      mockUserCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/admin/users')
        .set('Authorization', ADMIN_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/admin/users', 'get', 200, res.body);
    });

    it('GET /admin/audit-logs → 200 conforms to spec', async () => {
      authAdmin();
      mockAuditLogFindMany.mockResolvedValueOnce([makeAuditLog()]);
      mockAuditLogCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', ADMIN_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/admin/audit-logs', 'get', 200, res.body);
    });

    it('GET /admin/buses → 200 conforms to spec', async () => {
      authAdmin();
      mockBusFindMany.mockResolvedValueOnce([makeBus()]);
      mockBusCount.mockResolvedValueOnce(1);

      const res = await supertest(app.server)
        .get('/api/v1/admin/buses')
        .set('Authorization', ADMIN_AUTH)
        .expect(200);

      assertConforms(validator, '/api/v1/admin/buses', 'get', 200, res.body);
    });

    it('PATCH /admin/seats/:id → 200 conforms to spec', async () => {
      authAdmin();
      mockSeatFindUnique.mockResolvedValueOnce({ id: 'seat-1' });
      mockSeatUpdate.mockResolvedValueOnce({
        id: 'seat-1',
        row: 1,
        column: 1,
        label: '1A',
        type: 'STANDARD',
        price: 0,
        isEnabled: false,
        busId: 'bus-1',
      });

      const res = await supertest(app.server)
        .patch('/api/v1/admin/seats/seat-1')
        .set('Authorization', ADMIN_AUTH)
        .send({ isEnabled: false })
        .expect(200);

      assertConforms(validator, '/api/v1/admin/seats/{id}', 'patch', 200, res.body);
    });

    it('PATCH /admin/users/:id/status → 200 conforms to spec', async () => {
      authAdmin();
      const user = makeAdminUser({ id: 'user-1', status: 'ACTIVE' });
      // Service: updateUserStatus findUnique + revokeAllSessions findUnique
      mockUserFindUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(user);
      mockUserUpdate.mockResolvedValueOnce({ ...user, status: 'SUSPENDED' });
      mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 0 });
      mockAuditLogCreate.mockResolvedValueOnce({});

      const res = await supertest(app.server)
        .patch('/api/v1/admin/users/user-1/status')
        .set('Authorization', ADMIN_AUTH)
        .send({ action: 'suspend' })
        .expect(200);

      assertConforms(validator, '/api/v1/admin/users/{id}/status', 'patch', 200, res.body);
    });
  });
});
