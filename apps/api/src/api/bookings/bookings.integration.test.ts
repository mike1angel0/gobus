import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

// --- Mock setup ---
const mockBookingFindMany = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingUpdate = vi.fn();
const mockBookingCount = vi.fn();
const mockBookingSeatFindMany = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockTransaction = vi.fn();

const mockUserFindUnique = vi.fn();

const mockPrisma = {
  booking: {
    findMany: mockBookingFindMany,
    findUnique: mockBookingFindUnique,
    create: mockBookingCreate,
    update: mockBookingUpdate,
    count: mockBookingCount,
  },
  bookingSeat: {
    findMany: mockBookingSeatFindMany,
  },
  schedule: {
    findUnique: mockScheduleFindUnique,
  },
  user: {
    findUnique: mockUserFindUnique,
  },
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

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const AUTH_HEADER = createAuthHeader(USER_ID, 'PASSENGER');
const OTHER_AUTH_HEADER = createAuthHeader(OTHER_USER_ID, 'PASSENGER');

function makeBookingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    orderId: 'order-abc123',
    userId: USER_ID,
    scheduleId: 'sched-1',
    totalPrice: 100,
    status: 'CONFIRMED',
    boardingStop: 'Bucharest',
    alightingStop: 'Cluj',
    tripDate: new Date('2026-03-25T00:00:00.000Z'),
    createdAt: new Date('2026-03-20T10:00:00.000Z'),
    bookingSeats: [{ seatLabel: '1A' }, { seatLabel: '1B' }],
    schedule: {
      departureTime: new Date('2026-03-25T08:00:00.000Z'),
      arrivalTime: new Date('2026-03-25T12:00:00.000Z'),
      route: {
        id: 'route-1',
        name: 'Bucharest - Cluj',
        provider: { id: 'provider-1', name: 'FlixBus' },
      },
      bus: {
        id: 'bus-1',
        licensePlate: 'B-123-ABC',
        model: 'Mercedes Tourismo',
      },
    },
    ...overrides,
  };
}

function makeScheduleForCreate() {
  return {
    id: 'sched-1',
    stopTimes: [
      { stopName: 'Bucharest', orderIndex: 0, priceFromStart: 0 },
      { stopName: 'Pitesti', orderIndex: 1, priceFromStart: 20 },
      { stopName: 'Cluj', orderIndex: 2, priceFromStart: 50 },
    ],
    bus: {
      seats: [
        { label: '1A', isEnabled: true, type: 'STANDARD' },
        { label: '1B', isEnabled: true, type: 'STANDARD' },
        { label: '2A', isEnabled: true, type: 'PREMIUM' },
      ],
    },
  };
}

describe('Booking Routes', () => {
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
    // Auth plugin looks up user status in DB for every authenticated request
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, status: 'ACTIVE' });
  });

  // --- GET /api/v1/bookings ---
  describe('GET /api/v1/bookings', () => {
    it('returns 200 with paginated bookings for authenticated user', async () => {
      const booking = makeBookingRecord();
      mockBookingFindMany.mockResolvedValueOnce([booking]);
      mockBookingCount.mockResolvedValueOnce(1);

      const response = await supertest(app.server)
        .get('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('booking-1');
      expect(response.body.data[0].orderId).toBe('order-abc123');
      expect(response.body.data[0].userId).toBe(USER_ID);
      expect(response.body.data[0].scheduleId).toBe('sched-1');
      expect(response.body.data[0].totalPrice).toBe(100);
      expect(response.body.data[0].status).toBe('CONFIRMED');
      expect(response.body.data[0].boardingStop).toBe('Bucharest');
      expect(response.body.data[0].alightingStop).toBe('Cluj');
      expect(response.body.data[0].tripDate).toBe('2026-03-25T00:00:00.000Z');
      expect(response.body.data[0].seatLabels).toEqual(['1A', '1B']);
      expect(response.body.data[0].createdAt).toBe('2026-03-20T10:00:00.000Z');
      // List response should NOT include schedule details
      expect(response.body.data[0].schedule).toBeUndefined();
      expect(response.body.meta.total).toBe(1);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(20);
      expect(response.body.meta.totalPages).toBe(1);
    });

    it('returns 200 with empty list when user has no bookings', async () => {
      mockBookingFindMany.mockResolvedValueOnce([]);
      mockBookingCount.mockResolvedValueOnce(0);

      const response = await supertest(app.server)
        .get('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.totalPages).toBe(0);
    });

    it('supports status filter query param', async () => {
      mockBookingFindMany.mockResolvedValueOnce([]);
      mockBookingCount.mockResolvedValueOnce(0);

      await supertest(app.server)
        .get('/api/v1/bookings')
        .query({ status: 'CANCELLED' })
        .set('Authorization', AUTH_HEADER)
        .expect(200);

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/bookings')
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- POST /api/v1/bookings ---
  describe('POST /api/v1/bookings', () => {
    it('returns 201 with booking details on successful creation', async () => {
      const createdBooking = makeBookingRecord();

      mockTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const txClient = {
          schedule: { findUnique: mockScheduleFindUnique },
          bookingSeat: { findMany: mockBookingSeatFindMany },
          booking: { create: mockBookingCreate },
        };
        mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleForCreate());
        mockBookingSeatFindMany.mockResolvedValueOnce([]);
        mockBookingCreate.mockResolvedValueOnce(createdBooking);
        return callback(txClient);
      });

      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .send({
          scheduleId: 'sched-1',
          seatLabels: ['1A', '1B'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj',
          tripDate: '2026-03-25',
        })
        .expect(201);

      expect(response.body.data.id).toBe('booking-1');
      expect(response.body.data.orderId).toBe('order-abc123');
      expect(response.body.data.status).toBe('CONFIRMED');
      expect(response.body.data.totalPrice).toBe(100);
      expect(response.body.data.seatLabels).toEqual(['1A', '1B']);
      expect(response.body.data.schedule.departureTime).toBe('2026-03-25T08:00:00.000Z');
      expect(response.body.data.schedule.arrivalTime).toBe('2026-03-25T12:00:00.000Z');
      expect(response.body.data.schedule.route.name).toBe('Bucharest - Cluj');
      expect(response.body.data.schedule.route.provider.name).toBe('FlixBus');
      expect(response.body.data.schedule.bus.licensePlate).toBe('B-123-ABC');
      expect(response.body.data.schedule.bus.model).toBe('Mercedes Tourismo');
    });

    it('returns 409 when seats are already booked (SEAT_CONFLICT)', async () => {
      mockTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const txClient = {
          schedule: { findUnique: mockScheduleFindUnique },
          bookingSeat: { findMany: mockBookingSeatFindMany },
          booking: { create: mockBookingCreate },
        };
        mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleForCreate());
        mockBookingSeatFindMany.mockResolvedValueOnce([{ seatLabel: '1A' }]);
        return callback(txClient);
      });

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
        .expect(409);

      expect(response.body.status).toBe(409);
      expect(response.body.code).toBe('SEAT_CONFLICT');
    });

    it('returns 404 when schedule does not exist', async () => {
      mockTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const txClient = {
          schedule: { findUnique: mockScheduleFindUnique },
          bookingSeat: { findMany: mockBookingSeatFindMany },
          booking: { create: mockBookingCreate },
        };
        mockScheduleFindUnique.mockResolvedValueOnce(null);
        return callback(txClient);
      });

      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .send({
          scheduleId: 'nonexistent',
          seatLabels: ['1A'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj',
          tripDate: '2026-03-25',
        })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 400 when body is missing required fields', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .send({ scheduleId: 'sched-1' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when boardingStop comes after alightingStop', async () => {
      mockTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const txClient = {
          schedule: { findUnique: mockScheduleFindUnique },
          bookingSeat: { findMany: mockBookingSeatFindMany },
          booking: { create: mockBookingCreate },
        };
        mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleForCreate());
        return callback(txClient);
      });

      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .set('Authorization', AUTH_HEADER)
        .send({
          scheduleId: 'sched-1',
          seatLabels: ['1A'],
          boardingStop: 'Cluj',
          alightingStop: 'Bucharest',
          tripDate: '2026-03-25',
        })
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/bookings')
        .send({
          scheduleId: 'sched-1',
          seatLabels: ['1A'],
          boardingStop: 'Bucharest',
          alightingStop: 'Cluj',
          tripDate: '2026-03-25',
        })
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- GET /api/v1/bookings/:id ---
  describe('GET /api/v1/bookings/:id', () => {
    it('returns 200 with booking details for owned booking', async () => {
      mockBookingFindUnique.mockResolvedValueOnce(makeBookingRecord());

      const response = await supertest(app.server)
        .get('/api/v1/bookings/booking-1')
        .set('Authorization', AUTH_HEADER)
        .expect(200);

      expect(response.body.data.id).toBe('booking-1');
      expect(response.body.data.orderId).toBe('order-abc123');
      expect(response.body.data.schedule.route.name).toBe('Bucharest - Cluj');
      expect(response.body.data.schedule.bus.model).toBe('Mercedes Tourismo');
    });

    it('returns 404 when booking belongs to another user (ownership enforcement)', async () => {
      mockBookingFindUnique.mockResolvedValueOnce(makeBookingRecord());

      const response = await supertest(app.server)
        .get('/api/v1/bookings/booking-1')
        .set('Authorization', OTHER_AUTH_HEADER)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 404 when booking does not exist', async () => {
      mockBookingFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .get('/api/v1/bookings/nonexistent')
        .set('Authorization', AUTH_HEADER)
        .expect(404);

      expect(response.body.status).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/bookings/booking-1')
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- DELETE /api/v1/bookings/:id ---
  describe('DELETE /api/v1/bookings/:id', () => {
    it('returns 200 with cancelled booking on successful cancel', async () => {
      const confirmedBooking = makeBookingRecord();
      const cancelledBooking = makeBookingRecord({ status: 'CANCELLED' });
      mockBookingFindUnique.mockResolvedValueOnce(confirmedBooking);
      mockBookingUpdate.mockResolvedValueOnce(cancelledBooking);

      const response = await supertest(app.server)
        .delete('/api/v1/bookings/booking-1')
        .set('Authorization', AUTH_HEADER)
        .expect(200);

      expect(response.body.data.id).toBe('booking-1');
      expect(response.body.data.status).toBe('CANCELLED');
      expect(response.body.data.schedule.route.name).toBe('Bucharest - Cluj');
    });

    it('returns 404 when booking belongs to another user (ownership enforcement)', async () => {
      mockBookingFindUnique.mockResolvedValueOnce(makeBookingRecord());

      const response = await supertest(app.server)
        .delete('/api/v1/bookings/booking-1')
        .set('Authorization', OTHER_AUTH_HEADER)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 400 when booking is already cancelled', async () => {
      mockBookingFindUnique.mockResolvedValueOnce(
        makeBookingRecord({ status: 'CANCELLED' }),
      );

      const response = await supertest(app.server)
        .delete('/api/v1/bookings/booking-1')
        .set('Authorization', AUTH_HEADER)
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when booking does not exist', async () => {
      mockBookingFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .delete('/api/v1/bookings/nonexistent')
        .set('Authorization', AUTH_HEADER)
        .expect(404);

      expect(response.body.status).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .delete('/api/v1/bookings/booking-1')
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });
});
