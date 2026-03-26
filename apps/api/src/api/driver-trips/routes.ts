import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { DriverTripService } from '@/application/services/driver-trip.service.js';
import type {
  DriverTrip,
  DriverTripDetail,
  DriverTripStopTime,
} from '@/domain/driver-trips/driver-trip.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { listDriverTripsQuerySchema, scheduleIdParamSchema } from '@/api/driver-trips/schemas.js';
import { strictParse } from '@/shared/schemas.js';
import { privateNoCache } from '@/api/plugins/cache-control.js';

/** Serialize a DriverTrip entity to a JSON-safe object. */
function serializeDriverTrip(trip: DriverTrip): Record<string, unknown> {
  return {
    scheduleId: trip.scheduleId,
    departureTime: trip.departureTime.toISOString(),
    arrivalTime: trip.arrivalTime.toISOString(),
    tripDate: trip.tripDate.toISOString().slice(0, 10),
    routeName: trip.routeName,
    busLicensePlate: trip.busLicensePlate,
    status: trip.status,
  };
}

/** Serialize a stop time to a JSON-safe object. */
function serializeStopTime(stop: DriverTripStopTime): Record<string, unknown> {
  return {
    id: stop.id,
    stopName: stop.stopName,
    arrivalTime: stop.arrivalTime.toISOString(),
    departureTime: stop.departureTime.toISOString(),
    orderIndex: stop.orderIndex,
    priceFromStart: stop.priceFromStart,
    lat: stop.lat,
    lng: stop.lng,
  };
}

/** Serialize a DriverTripDetail entity to a JSON-safe object. */
function serializeDriverTripDetail(detail: DriverTripDetail): Record<string, unknown> {
  return {
    scheduleId: detail.scheduleId,
    departureTime: detail.departureTime.toISOString(),
    arrivalTime: detail.arrivalTime.toISOString(),
    tripDate: detail.tripDate.toISOString().slice(0, 10),
    routeName: detail.routeName,
    busId: detail.busId,
    busLicensePlate: detail.busLicensePlate,
    busModel: detail.busModel,
    status: detail.status,
    stops: detail.stops.map(serializeStopTime),
    passengerCount: detail.passengerCount,
    totalSeats: detail.totalSeats,
  };
}

/** Register driver trip API routes. */
async function driverTripRoutes(app: FastifyInstance): Promise<void> {
  const driverTripService = new DriverTripService(getPrisma());

  app.get(
    '/api/v1/driver/trips',
    { preHandler: [app.authenticate, privateNoCache] },
    async (request) => {
      if (request.user.role !== 'DRIVER') {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only drivers can access trip list');
      }

      const { date, page, pageSize } = strictParse(listDriverTripsQuerySchema, request.query);
      const result = await driverTripService.listTrips(request.user.id, date, page, pageSize);

      return { data: result.data.map(serializeDriverTrip), meta: result.meta };
    },
  );

  app.get(
    '/api/v1/driver/trips/:scheduleId',
    { preHandler: [app.authenticate, privateNoCache] },
    async (request) => {
      if (request.user.role !== 'DRIVER') {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only drivers can access trip details');
      }

      const { scheduleId } = strictParse(scheduleIdParamSchema, request.params);
      const query = strictParse(listDriverTripsQuerySchema, request.query);
      const detail = await driverTripService.getTripDetail(request.user.id, scheduleId, query.date);

      return { data: serializeDriverTripDetail(detail) };
    },
  );

  app.get(
    '/api/v1/driver/trips/:scheduleId/passengers',
    { preHandler: [app.authenticate, privateNoCache] },
    async (request) => {
      if (request.user.role !== 'DRIVER') {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only drivers can access passenger list');
      }

      const { scheduleId } = strictParse(scheduleIdParamSchema, request.params);
      const query = strictParse(listDriverTripsQuerySchema, request.query);
      const passengers = await driverTripService.getPassengers(
        request.user.id,
        scheduleId,
        query.date,
      );

      return { data: passengers };
    },
  );
}

export default fp(driverTripRoutes, {
  name: 'driver-trip-routes',
  dependencies: ['auth'],
});
