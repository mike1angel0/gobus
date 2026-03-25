import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { BookingService } from '@/application/services/booking.service.js';
import type { BookingWithDetails } from '@/application/services/booking.service.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { idParamSchema } from '@/shared/schemas.js';
import { createBookingBodySchema, listBookingsQuerySchema } from '@/api/bookings/schemas.js';

/**
 * Serialize a BookingWithDetails domain entity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeBookingWithDetails(booking: BookingWithDetails): Record<string, unknown> {
  return {
    id: booking.id,
    orderId: booking.orderId,
    userId: booking.userId,
    scheduleId: booking.scheduleId,
    totalPrice: booking.totalPrice,
    status: booking.status,
    boardingStop: booking.boardingStop,
    alightingStop: booking.alightingStop,
    tripDate: booking.tripDate.toISOString(),
    seatLabels: booking.seatLabels,
    createdAt: booking.createdAt.toISOString(),
    schedule: {
      departureTime: booking.schedule.departureTime.toISOString(),
      arrivalTime: booking.schedule.arrivalTime.toISOString(),
      route: {
        id: booking.schedule.route.id,
        name: booking.schedule.route.name,
        provider: {
          id: booking.schedule.route.provider.id,
          name: booking.schedule.route.provider.name,
        },
      },
      bus: {
        id: booking.schedule.bus.id,
        licensePlate: booking.schedule.bus.licensePlate,
        model: booking.schedule.bus.model,
      },
    },
  };
}

/**
 * Serialize a BookingWithDetails for list responses (without schedule details).
 * Convert Date fields to ISO strings to match the OpenAPI Booking schema.
 */
function serializeBookingForList(booking: BookingWithDetails): Record<string, unknown> {
  return {
    id: booking.id,
    orderId: booking.orderId,
    userId: booking.userId,
    scheduleId: booking.scheduleId,
    totalPrice: booking.totalPrice,
    status: booking.status,
    boardingStop: booking.boardingStop,
    alightingStop: booking.alightingStop,
    tripDate: booking.tripDate.toISOString(),
    seatLabels: booking.seatLabels,
    createdAt: booking.createdAt.toISOString(),
  };
}

/**
 * Register authenticated booking endpoints: list, create, detail, and cancel.
 * All endpoints require Bearer JWT authentication. Ownership enforced on detail and cancel.
 */
async function bookingRoutes(app: FastifyInstance): Promise<void> {
  const bookingService = new BookingService(getPrisma());

  // GET /api/v1/bookings — list user's bookings (paginated, optional status filter)
  app.get('/api/v1/bookings', { preHandler: [app.authenticate] }, async (request) => {
    const { page, pageSize, status } = listBookingsQuerySchema.parse(request.query);
    const result = await bookingService.listByUser(request.user.id, { page, pageSize, status });

    return {
      data: result.data.map(serializeBookingForList),
      meta: result.meta,
    };
  });

  // POST /api/v1/bookings — create a new booking
  app.post('/api/v1/bookings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = createBookingBodySchema.parse(request.body);
    const booking = await bookingService.create(request.user.id, body);

    return reply.status(201).send({ data: serializeBookingWithDetails(booking) });
  });

  // GET /api/v1/bookings/:id — get booking details (ownership enforced)
  app.get('/api/v1/bookings/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const booking = await bookingService.getById(id, request.user.id);

    return { data: serializeBookingWithDetails(booking) };
  });

  // DELETE /api/v1/bookings/:id — cancel a booking (ownership enforced)
  app.delete('/api/v1/bookings/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const booking = await bookingService.cancel(id, request.user.id);

    return { data: serializeBookingWithDetails(booking) };
  });
}

export default fp(bookingRoutes, {
  name: 'booking-routes',
  dependencies: ['auth'],
});
