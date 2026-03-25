import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp } from '@/test/helpers.js';

// --- Mock setup ---
const mockScheduleFindMany = vi.fn();
const mockScheduleFindUnique = vi.fn();

const mockPrisma = {
  schedule: {
    findMany: mockScheduleFindMany,
    findUnique: mockScheduleFindUnique,
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

function makeScheduleForSearch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    status: 'ACTIVE',
    departureTime: new Date('2026-03-25T08:00:00.000Z'),
    arrivalTime: new Date('2026-03-25T12:00:00.000Z'),
    basePrice: 50,
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: new Date('2026-03-25T08:00:00.000Z'),
        departureTime: new Date('2026-03-25T08:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
      },
      {
        id: 'st-2',
        stopName: 'Pitesti',
        arrivalTime: new Date('2026-03-25T09:30:00.000Z'),
        departureTime: new Date('2026-03-25T09:40:00.000Z'),
        orderIndex: 1,
        priceFromStart: 20,
      },
      {
        id: 'st-3',
        stopName: 'Cluj',
        arrivalTime: new Date('2026-03-25T11:50:00.000Z'),
        departureTime: new Date('2026-03-25T12:00:00.000Z'),
        orderIndex: 2,
        priceFromStart: 50,
      },
    ],
    route: {
      name: 'Bucharest - Cluj',
      provider: { name: 'FlixBus' },
    },
    bus: {
      seats: [
        { id: 'seat-1', isEnabled: true, type: 'STANDARD' },
        { id: 'seat-2', isEnabled: true, type: 'STANDARD' },
        { id: 'seat-3', isEnabled: true, type: 'PREMIUM' },
        { id: 'seat-4', isEnabled: false, type: 'STANDARD' },
        { id: 'seat-5', isEnabled: true, type: 'BLOCKED' },
      ],
    },
    bookingSeats: [{ seatLabel: '1A' }],
    delays: [{ id: 'delay-1', offsetMinutes: 15, reason: 'Traffic' }],
    ...overrides,
  };
}

function makeScheduleForDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    status: 'ACTIVE',
    departureTime: new Date('2026-03-25T08:00:00.000Z'),
    arrivalTime: new Date('2026-03-25T12:00:00.000Z'),
    basePrice: 50,
    stopTimes: [
      {
        id: 'st-1',
        stopName: 'Bucharest',
        arrivalTime: new Date('2026-03-25T08:00:00.000Z'),
        departureTime: new Date('2026-03-25T08:10:00.000Z'),
        orderIndex: 0,
        priceFromStart: 0,
      },
      {
        id: 'st-2',
        stopName: 'Cluj',
        arrivalTime: new Date('2026-03-25T11:50:00.000Z'),
        departureTime: new Date('2026-03-25T12:00:00.000Z'),
        orderIndex: 1,
        priceFromStart: 50,
      },
    ],
    route: {
      name: 'Bucharest - Cluj',
      provider: { name: 'FlixBus' },
    },
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
        {
          id: 'seat-3',
          row: 2,
          column: 1,
          label: '2A',
          type: 'PREMIUM',
          price: 10,
          isEnabled: true,
        },
      ],
    },
    bookingSeats: [{ seatLabel: '1A' }],
    ...overrides,
  };
}

describe('Search Routes', () => {
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

  // --- GET /api/v1/search ---
  describe('GET /api/v1/search', () => {
    it('returns 200 with search results and pagination', async () => {
      mockScheduleFindMany.mockResolvedValueOnce([makeScheduleForSearch()]);

      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'Bucharest', destination: 'Cluj', date: '2026-03-25' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].scheduleId).toBe('sched-1');
      expect(response.body.data[0].providerName).toBe('FlixBus');
      expect(response.body.data[0].routeName).toBe('Bucharest - Cluj');
      expect(response.body.data[0].origin).toBe('Bucharest');
      expect(response.body.data[0].destination).toBe('Cluj');
      expect(response.body.data[0].departureTime).toBe('2026-03-25T08:10:00.000Z');
      expect(response.body.data[0].arrivalTime).toBe('2026-03-25T11:50:00.000Z');
      expect(response.body.data[0].tripDate).toBe('2026-03-25');
      expect(response.body.data[0].price).toBe(50);
      // 3 enabled non-blocked seats, 1 booked = 2 available
      expect(response.body.data[0].availableSeats).toBe(2);
      expect(response.body.data[0].totalSeats).toBe(3);
      expect(response.body.meta.total).toBe(1);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(20);
      expect(response.body.meta.totalPages).toBe(1);
    });

    it('returns empty results when no schedules match', async () => {
      mockScheduleFindMany.mockResolvedValueOnce([]);

      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'Nowhere', destination: 'Neverland', date: '2026-03-25' })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.totalPages).toBe(0);
    });

    it('filters out schedules where destination comes before origin', async () => {
      // Return a schedule but query with reversed stops
      mockScheduleFindMany.mockResolvedValueOnce([makeScheduleForSearch()]);

      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'Cluj', destination: 'Bucharest', date: '2026-03-25' })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('does not require authentication (public endpoint)', async () => {
      mockScheduleFindMany.mockResolvedValueOnce([]);

      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'A', destination: 'B', date: '2026-03-25' })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('returns 400 when origin is missing', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ destination: 'Cluj', date: '2026-03-25' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when destination is missing', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'Bucharest', date: '2026-03-25' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when date is missing', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'Bucharest', destination: 'Cluj' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when date has invalid format', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({ origin: 'Bucharest', destination: 'Cluj', date: 'not-a-date' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('supports pagination query params', async () => {
      // Create 3 schedules with different IDs
      const schedules = [
        makeScheduleForSearch({ id: 'sched-1' }),
        makeScheduleForSearch({ id: 'sched-2' }),
        makeScheduleForSearch({ id: 'sched-3' }),
      ];
      mockScheduleFindMany.mockResolvedValueOnce(schedules);

      const response = await supertest(app.server)
        .get('/api/v1/search')
        .query({
          origin: 'Bucharest',
          destination: 'Cluj',
          date: '2026-03-25',
          page: 1,
          pageSize: 2,
        })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(3);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(2);
      expect(response.body.meta.totalPages).toBe(2);
    });
  });

  // --- GET /api/v1/trips/:scheduleId ---
  describe('GET /api/v1/trips/:scheduleId', () => {
    it('returns 200 with trip details and seat availability', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleForDetail());

      const response = await supertest(app.server)
        .get('/api/v1/trips/sched-1')
        .query({ tripDate: '2026-03-25' })
        .expect(200);

      expect(response.body.data.scheduleId).toBe('sched-1');
      expect(response.body.data.routeName).toBe('Bucharest - Cluj');
      expect(response.body.data.providerName).toBe('FlixBus');
      expect(response.body.data.departureTime).toBe('2026-03-25T08:00:00.000Z');
      expect(response.body.data.arrivalTime).toBe('2026-03-25T12:00:00.000Z');
      expect(response.body.data.tripDate).toBe('2026-03-25');
      expect(response.body.data.basePrice).toBe(50);
      expect(response.body.data.status).toBe('ACTIVE');

      // Stop times
      expect(response.body.data.stopTimes).toHaveLength(2);
      expect(response.body.data.stopTimes[0].stopName).toBe('Bucharest');
      expect(response.body.data.stopTimes[0].arrivalTime).toBe('2026-03-25T08:00:00.000Z');
      expect(response.body.data.stopTimes[0].orderIndex).toBe(0);
      expect(response.body.data.stopTimes[0].priceFromStart).toBe(0);
      expect(response.body.data.stopTimes[1].stopName).toBe('Cluj');
      expect(response.body.data.stopTimes[1].priceFromStart).toBe(50);

      // Seats with availability
      expect(response.body.data.seats).toHaveLength(3);
      expect(response.body.data.seats[0].label).toBe('1A');
      expect(response.body.data.seats[0].isBooked).toBe(true);
      expect(response.body.data.seats[1].label).toBe('1B');
      expect(response.body.data.seats[1].isBooked).toBe(false);
      expect(response.body.data.seats[2].label).toBe('2A');
      expect(response.body.data.seats[2].isBooked).toBe(false);
      expect(response.body.data.seats[2].type).toBe('PREMIUM');
      expect(response.body.data.seats[2].price).toBe(10);
    });

    it('returns 404 when schedule not found', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .get('/api/v1/trips/nonexistent')
        .query({ tripDate: '2026-03-25' })
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 400 when tripDate is missing', async () => {
      const response = await supertest(app.server).get('/api/v1/trips/sched-1').expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 when tripDate has invalid format', async () => {
      const response = await supertest(app.server)
        .get('/api/v1/trips/sched-1')
        .query({ tripDate: 'invalid' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('does not require authentication (public endpoint)', async () => {
      mockScheduleFindUnique.mockResolvedValueOnce(makeScheduleForDetail());

      const response = await supertest(app.server)
        .get('/api/v1/trips/sched-1')
        .query({ tripDate: '2026-03-25' })
        .expect(200);

      expect(response.body.data.scheduleId).toBe('sched-1');
    });

    it('returns trip with all seats unbooked when no bookings exist', async () => {
      const schedule = makeScheduleForDetail({ bookingSeats: [] });
      // Need to explicitly override since makeScheduleForDetail spreads overrides at top level
      // but bookingSeats is nested — let's set it directly
      (schedule as Record<string, unknown>).bookingSeats = [];
      mockScheduleFindUnique.mockResolvedValueOnce(schedule);

      const response = await supertest(app.server)
        .get('/api/v1/trips/sched-1')
        .query({ tripDate: '2026-03-25' })
        .expect(200);

      expect(response.body.data.seats[0].isBooked).toBe(false);
      expect(response.body.data.seats[1].isBooked).toBe(false);
      expect(response.body.data.seats[2].isBooked).toBe(false);
    });
  });
});
