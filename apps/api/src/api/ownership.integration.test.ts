import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockRouteDelete = vi.fn();
const mockBusFindUnique = vi.fn();
const mockBusUpdate = vi.fn();
const mockBusDelete = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockScheduleUpdate = vi.fn();
const mockScheduleCount = vi.fn();
const mockScheduleUpdateMany = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockBookingUpdate = vi.fn();
const mockDelayFindUnique = vi.fn();
const mockDelayUpdate = vi.fn();
const mockUserDelete = vi.fn();
const mockTransaction = vi.fn();
const mockAuditLogCreate = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    findMany: mockUserFindMany,
    count: mockUserCount,
    delete: mockUserDelete,
  },
  route: { findUnique: mockRouteFindUnique, delete: mockRouteDelete },
  bus: { findUnique: mockBusFindUnique, update: mockBusUpdate, delete: mockBusDelete },
  schedule: {
    findUnique: mockScheduleFindUnique,
    update: mockScheduleUpdate,
    count: mockScheduleCount,
    updateMany: mockScheduleUpdateMany,
  },
  booking: { findUnique: mockBookingFindUnique, update: mockBookingUpdate },
  delay: { findUnique: mockDelayFindUnique, update: mockDelayUpdate },
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

// --- Auth helpers ---
// Provider A (prov-A) owns routes, buses, schedules, drivers
const PROVIDER_A_AUTH = () =>
  createAuthHeader('user-provider-a', 'PROVIDER', {
    email: 'providerA@test.com',
    providerId: 'prov-A',
  });

// Provider B (prov-B) is a different provider — should NOT access A's resources
const PROVIDER_B_AUTH = () =>
  createAuthHeader('user-provider-b', 'PROVIDER', {
    email: 'providerB@test.com',
    providerId: 'prov-B',
  });

// Passenger A owns bookings
const PASSENGER_A_AUTH = () =>
  createAuthHeader('passenger-a', 'PASSENGER', {
    email: 'passengerA@test.com',
  });

// Passenger B should NOT access Passenger A's bookings
const PASSENGER_B_AUTH = () =>
  createAuthHeader('passenger-b', 'PASSENGER', {
    email: 'passengerB@test.com',
  });

function mockAuthUser(id: string) {
  mockUserFindUnique.mockResolvedValueOnce({ id, status: 'ACTIVE' });
}

describe('BOLA/IDOR Ownership Enforcement', () => {
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
    mockTransaction.mockImplementation((actions: unknown[]) => Promise.all(actions));
  });

  // ===========================
  // Provider A vs Provider B
  // ===========================

  describe('Provider A cannot access Provider B resources', () => {
    // --- Routes ---
    describe('Routes', () => {
      it('DELETE /routes/:id — returns 404 for route owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Route belongs to Provider A
        mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-A' });

        const response = await supertest(app.server)
          .delete('/api/v1/routes/route-of-A')
          .set('Authorization', PROVIDER_B_AUTH())
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(mockRouteDelete).not.toHaveBeenCalled();
      });

      it('GET /routes/:id — returns 404 for route owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Route belongs to Provider A, Provider B tries to read
        mockRouteFindUnique.mockResolvedValueOnce({
          id: 'route-of-A',
          name: 'Secret Route',
          providerId: 'prov-A',
          createdAt: new Date(),
          stops: [],
        });

        const response = await supertest(app.server)
          .get('/api/v1/routes/route-of-A')
          .set('Authorization', PROVIDER_B_AUTH())
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
      });
    });

    // --- Buses ---
    describe('Buses', () => {
      it('PUT /buses/:id — returns 404 for bus owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Bus belongs to Provider A
        mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-A' });

        const response = await supertest(app.server)
          .put('/api/v1/buses/bus-of-A')
          .set('Authorization', PROVIDER_B_AUTH())
          .send({ model: 'Hacked Model' })
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(mockBusUpdate).not.toHaveBeenCalled();
      });

      it('DELETE /buses/:id — returns 404 for bus owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Bus belongs to Provider A
        mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-A' });

        const response = await supertest(app.server)
          .delete('/api/v1/buses/bus-of-A')
          .set('Authorization', PROVIDER_B_AUTH())
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(mockBusDelete).not.toHaveBeenCalled();
      });
    });

    // --- Schedules ---
    describe('Schedules', () => {
      it('PUT /schedules/:id — returns 404 for schedule owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Schedule's route belongs to Provider A
        mockScheduleFindUnique.mockResolvedValueOnce({
          id: 'sched-of-A',
          route: { providerId: 'prov-A' },
        });

        const response = await supertest(app.server)
          .put('/api/v1/schedules/sched-of-A')
          .set('Authorization', PROVIDER_B_AUTH())
          .send({ status: 'CANCELLED' })
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(mockScheduleUpdate).not.toHaveBeenCalled();
      });

      it('DELETE /schedules/:id — returns 404 for schedule owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Schedule's route belongs to Provider A
        mockScheduleFindUnique.mockResolvedValueOnce({
          id: 'sched-of-A',
          route: { providerId: 'prov-A' },
        });

        const response = await supertest(app.server)
          .delete('/api/v1/schedules/sched-of-A')
          .set('Authorization', PROVIDER_B_AUTH())
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(mockScheduleUpdate).not.toHaveBeenCalled();
      });

      it('POST /schedules — returns 404 when route belongs to another provider', async () => {
        mockAuthUser('user-provider-b');
        // Route belongs to Provider A, Provider B tries to create schedule with it
        mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-A' });
        mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-B' });

        const response = await supertest(app.server)
          .post('/api/v1/schedules')
          .set('Authorization', PROVIDER_B_AUTH())
          .send({
            routeId: 'route-of-A',
            busId: 'bus-of-B',
            departureTime: '2025-06-01T08:00:00.000Z',
            arrivalTime: '2025-06-01T12:00:00.000Z',
            basePrice: 50,
            tripDate: '2025-06-01T00:00:00.000Z',
            stopTimes: [
              {
                stopName: 'A',
                arrivalTime: '2025-06-01T08:00:00.000Z',
                departureTime: '2025-06-01T08:05:00.000Z',
                orderIndex: 0,
                priceFromStart: 0,
              },
              {
                stopName: 'B',
                arrivalTime: '2025-06-01T12:00:00.000Z',
                departureTime: '2025-06-01T12:00:00.000Z',
                orderIndex: 1,
                priceFromStart: 50,
              },
            ],
          })
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
      });

      it('POST /schedules — returns 404 when bus belongs to another provider', async () => {
        mockAuthUser('user-provider-b');
        // Route belongs to Provider B (OK), Bus belongs to Provider A (NOT OK)
        mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-B' });
        mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-A' });

        const response = await supertest(app.server)
          .post('/api/v1/schedules')
          .set('Authorization', PROVIDER_B_AUTH())
          .send({
            routeId: 'route-of-B',
            busId: 'bus-of-A',
            departureTime: '2025-06-01T08:00:00.000Z',
            arrivalTime: '2025-06-01T12:00:00.000Z',
            basePrice: 50,
            tripDate: '2025-06-01T00:00:00.000Z',
            stopTimes: [
              {
                stopName: 'A',
                arrivalTime: '2025-06-01T08:00:00.000Z',
                departureTime: '2025-06-01T08:05:00.000Z',
                orderIndex: 0,
                priceFromStart: 0,
              },
              {
                stopName: 'B',
                arrivalTime: '2025-06-01T12:00:00.000Z',
                departureTime: '2025-06-01T12:00:00.000Z',
                orderIndex: 1,
                priceFromStart: 50,
              },
            ],
          })
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
      });
    });

    // --- Delays ---
    describe('Delays', () => {
      it('PUT /delays/:id — returns 404 for delay on schedule owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Delay's schedule's route belongs to Provider A
        mockDelayFindUnique.mockResolvedValueOnce({
          id: 'delay-1',
          schedule: { route: { providerId: 'prov-A' } },
        });

        const response = await supertest(app.server)
          .put('/api/v1/delays/delay-1')
          .set('Authorization', PROVIDER_B_AUTH())
          .send({ offsetMinutes: 30 })
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(mockDelayUpdate).not.toHaveBeenCalled();
      });
    });

    // --- Drivers ---
    describe('Drivers', () => {
      it('DELETE /drivers/:id — returns 404 for driver owned by another provider', async () => {
        mockAuthUser('user-provider-b');
        // Driver belongs to Provider A
        mockUserFindUnique.mockResolvedValueOnce({
          id: 'driver-of-A',
          role: 'DRIVER',
          providerId: 'prov-A',
        });

        const response = await supertest(app.server)
          .delete('/api/v1/drivers/driver-of-A')
          .set('Authorization', PROVIDER_B_AUTH())
          .expect(404);

        expect(response.body.status).toBe(404);
        expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(mockUserDelete).not.toHaveBeenCalled();
      });
    });
  });

  // ===========================
  // Passenger A vs Passenger B
  // ===========================

  describe('Passenger A cannot access Passenger B bookings', () => {
    it('GET /bookings/:id — returns 404 for booking owned by another user', async () => {
      mockAuthUser('passenger-b');
      // Booking belongs to Passenger A
      mockBookingFindUnique.mockResolvedValueOnce({
        id: 'booking-of-A',
        orderId: 'ORD-001',
        userId: 'passenger-a',
        scheduleId: 'sched-1',
        totalPrice: 100,
        status: 'CONFIRMED',
        boardingStop: 'Stop A',
        alightingStop: 'Stop B',
        tripDate: new Date('2025-06-01'),
        createdAt: new Date(),
        bookingSeats: [{ seatLabel: '1A' }],
        schedule: {
          departureTime: new Date(),
          arrivalTime: new Date(),
          route: { id: 'r1', name: 'Route 1', provider: { id: 'p1', name: 'Provider' } },
          bus: { id: 'b1', licensePlate: 'XX-00', model: 'Bus' },
        },
      });

      const response = await supertest(app.server)
        .get('/api/v1/bookings/booking-of-A')
        .set('Authorization', PASSENGER_B_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('DELETE /bookings/:id — returns 404 when cancelling another user booking', async () => {
      mockAuthUser('passenger-b');
      // Booking belongs to Passenger A
      mockBookingFindUnique.mockResolvedValueOnce({
        id: 'booking-of-A',
        userId: 'passenger-a',
        status: 'CONFIRMED',
      });

      const response = await supertest(app.server)
        .delete('/api/v1/bookings/booking-of-A')
        .set('Authorization', PASSENGER_B_AUTH())
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
      expect(mockBookingUpdate).not.toHaveBeenCalled();
    });
  });

  // ===========================
  // All ownership failures return 404 (not 403)
  // ===========================

  describe('Ownership failures always return 404 (not 403)', () => {
    it('route owned by another provider returns 404, not 403', async () => {
      mockAuthUser('user-provider-b');
      mockRouteFindUnique.mockResolvedValueOnce({ providerId: 'prov-A' });

      const response = await supertest(app.server)
        .delete('/api/v1/routes/route-of-A')
        .set('Authorization', PROVIDER_B_AUTH());

      expect(response.status).toBe(404);
      expect(response.body.status).not.toBe(403);
    });

    it('bus owned by another provider returns 404, not 403', async () => {
      mockAuthUser('user-provider-b');
      mockBusFindUnique.mockResolvedValueOnce({ providerId: 'prov-A' });

      const response = await supertest(app.server)
        .delete('/api/v1/buses/bus-of-A')
        .set('Authorization', PROVIDER_B_AUTH());

      expect(response.status).toBe(404);
      expect(response.body.status).not.toBe(403);
    });

    it('booking owned by another user returns 404, not 403', async () => {
      mockAuthUser('passenger-b');
      mockBookingFindUnique.mockResolvedValueOnce({
        id: 'booking-of-A',
        userId: 'passenger-a',
        status: 'CONFIRMED',
      });

      const response = await supertest(app.server)
        .get('/api/v1/bookings/booking-of-A')
        .set('Authorization', PASSENGER_B_AUTH());

      expect(response.status).toBe(404);
      expect(response.body.status).not.toBe(403);
    });
  });

  // ===========================
  // Admin seat toggle requires ADMIN role
  // ===========================

  describe('Admin seat toggle requires ADMIN role', () => {
    it('PROVIDER cannot toggle seats (requires ADMIN)', async () => {
      mockAuthUser('user-provider-a');

      const response = await supertest(app.server)
        .patch('/api/v1/admin/seats/seat-1')
        .set('Authorization', PROVIDER_A_AUTH())
        .send({ isEnabled: false })
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('PASSENGER cannot toggle seats (requires ADMIN)', async () => {
      mockAuthUser('passenger-a');

      const response = await supertest(app.server)
        .patch('/api/v1/admin/seats/seat-1')
        .set('Authorization', PASSENGER_A_AUTH())
        .send({ isEnabled: false })
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });
});
