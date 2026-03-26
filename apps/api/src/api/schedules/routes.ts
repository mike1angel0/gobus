import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { ScheduleService } from '@/application/services/schedule.service.js';
import type {
  ScheduleEntity,
  ScheduleWithDetails,
  StopTimeEntity,
} from '@/domain/schedules/schedule.entity.js';
import type {
  ScheduleRouteSummary,
  ScheduleBusSummary,
  ScheduleDriverSummary,
} from '@/domain/schedules/schedule.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireProvider } from '@/api/plugins/role-guard.js';
import { idParamSchema, strictParse } from '@/shared/schemas.js';
import { noCache, privateNoCache } from '@/api/plugins/cache-control.js';
import {
  scheduleFilterQuerySchema,
  createScheduleRequestSchema,
  updateScheduleRequestSchema,
} from '@/api/schedules/schemas.js';

/**
 * Serialize a StopTimeEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeStopTime(stopTime: StopTimeEntity): Record<string, unknown> {
  return {
    id: stopTime.id,
    stopName: stopTime.stopName,
    arrivalTime: stopTime.arrivalTime.toISOString(),
    departureTime: stopTime.departureTime.toISOString(),
    orderIndex: stopTime.orderIndex,
    priceFromStart: stopTime.priceFromStart,
    lat: stopTime.lat,
    lng: stopTime.lng,
  };
}

/**
 * Serialize a ScheduleRouteSummary to a JSON-safe response object.
 * Convert Date fields to ISO strings.
 */
function serializeRoute(route: ScheduleRouteSummary): Record<string, unknown> {
  return {
    ...route,
    createdAt: route.createdAt.toISOString(),
  };
}

/**
 * Serialize a ScheduleBusSummary to a JSON-safe response object.
 * Convert Date fields to ISO strings.
 */
function serializeBus(bus: ScheduleBusSummary): Record<string, unknown> {
  return {
    ...bus,
    createdAt: bus.createdAt.toISOString(),
  };
}

/**
 * Serialize a ScheduleDriverSummary to a JSON-safe response object.
 * Return null when driver is not assigned.
 */
function serializeDriver(driver: ScheduleDriverSummary | null): Record<string, unknown> | null {
  if (!driver) return null;
  return { id: driver.id, name: driver.name };
}

/**
 * Serialize a ScheduleEntity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeSchedule(schedule: ScheduleEntity): Record<string, unknown> {
  return {
    id: schedule.id,
    routeId: schedule.routeId,
    busId: schedule.busId,
    driverId: schedule.driverId,
    departureTime: schedule.departureTime.toISOString(),
    arrivalTime: schedule.arrivalTime.toISOString(),
    daysOfWeek: schedule.daysOfWeek,
    basePrice: schedule.basePrice,
    status: schedule.status,
    tripDate: schedule.tripDate.toISOString().slice(0, 10),
    createdAt: schedule.createdAt.toISOString(),
  };
}

/**
 * Serialize a ScheduleWithDetails to a JSON-safe response object.
 * Include serialized stop times, route, bus, and driver.
 */
function serializeScheduleWithDetails(schedule: ScheduleWithDetails): Record<string, unknown> {
  return {
    ...serializeSchedule(schedule),
    stopTimes: schedule.stopTimes.map(serializeStopTime),
    route: serializeRoute(schedule.route),
    bus: serializeBus(schedule.bus),
    driver: serializeDriver(schedule.driver),
  };
}

/**
 * Register all schedule management endpoints under /api/v1/schedules.
 * Implements GET (list), POST (create), GET /:id (detail), PUT /:id (update),
 * DELETE /:id (cancel) from the OpenAPI spec.
 * All endpoints require PROVIDER role.
 */
async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  const scheduleService = new ScheduleService(getPrisma());

  // GET /api/v1/schedules — list provider's schedules (paginated, filterable)
  app.get(
    '/api/v1/schedules',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const { page, pageSize, routeId, busId, status, fromDate, toDate } = strictParse(
        scheduleFilterQuerySchema,
        request.query,
      );
      const providerId = request.user.providerId!;

      const filters = {
        routeId,
        busId,
        status,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
      };

      const result = await scheduleService.listByProvider(providerId, { page, pageSize }, filters);

      return {
        data: result.data.map(serializeSchedule),
        meta: result.meta,
      };
    },
  );

  // POST /api/v1/schedules — create a new schedule with stop times
  app.post(
    '/api/v1/schedules',
    { preHandler: [app.authenticate, requireProvider, noCache] },
    async (request, reply) => {
      const body = strictParse(createScheduleRequestSchema, request.body);
      const providerId = request.user.providerId!;

      const schedule = await scheduleService.create(providerId, {
        routeId: body.routeId,
        busId: body.busId,
        driverId: body.driverId,
        departureTime: new Date(body.departureTime),
        arrivalTime: new Date(body.arrivalTime),
        daysOfWeek: body.daysOfWeek,
        basePrice: body.basePrice,
        tripDate: new Date(body.tripDate),
        stopTimes: body.stopTimes.map((st) => ({
          stopName: st.stopName,
          arrivalTime: new Date(st.arrivalTime),
          departureTime: new Date(st.departureTime),
          orderIndex: st.orderIndex,
          priceFromStart: st.priceFromStart,
          lat: st.lat,
          lng: st.lng,
        })),
      });

      return reply.status(201).send({ data: serializeScheduleWithDetails(schedule) });
    },
  );

  // GET /api/v1/schedules/:id — get schedule details
  app.get(
    '/api/v1/schedules/:id',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const { id } = strictParse(idParamSchema, request.params);
      const providerId = request.user.providerId!;

      const schedule = await scheduleService.getById(id, providerId);

      return { data: serializeScheduleWithDetails(schedule) };
    },
  );

  // PUT /api/v1/schedules/:id — update a schedule
  app.put(
    '/api/v1/schedules/:id',
    { preHandler: [app.authenticate, requireProvider, noCache] },
    async (request) => {
      const { id } = strictParse(idParamSchema, request.params);
      const body = strictParse(updateScheduleRequestSchema, request.body);
      const providerId = request.user.providerId!;

      const updateData = {
        driverId: body.driverId,
        status: body.status,
        departureTime: body.departureTime ? new Date(body.departureTime) : undefined,
        arrivalTime: body.arrivalTime ? new Date(body.arrivalTime) : undefined,
      };

      const schedule = await scheduleService.update(id, providerId, updateData);

      return { data: serializeScheduleWithDetails(schedule) };
    },
  );

  // DELETE /api/v1/schedules/:id — cancel a schedule
  app.delete(
    '/api/v1/schedules/:id',
    { preHandler: [app.authenticate, requireProvider, noCache] },
    async (request, reply) => {
      const { id } = strictParse(idParamSchema, request.params);
      const providerId = request.user.providerId!;

      await scheduleService.cancel(id, providerId);

      return reply.status(204).send();
    },
  );
}

export default fp(scheduleRoutes, {
  name: 'schedule-routes',
  dependencies: ['auth'],
});
