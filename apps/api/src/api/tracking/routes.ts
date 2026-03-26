import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { TrackingService } from '@/application/services/tracking.service.js';
import type { BusTrackingData } from '@/domain/tracking/tracking.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { busIdParamSchema, trackingUpdateSchema } from '@/api/tracking/schemas.js';
import { noCache } from '@/api/plugins/cache-control.js';

/**
 * Serialize a BusTrackingData domain entity to a JSON-safe response object.
 * Convert Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeTrackingData(data: BusTrackingData): Record<string, unknown> {
  return {
    id: data.id,
    busId: data.busId,
    lat: data.lat,
    lng: data.lng,
    speed: data.speed,
    heading: data.heading,
    scheduleId: data.scheduleId,
    currentStopIndex: data.currentStopIndex,
    isActive: data.isActive,
    tripDate: data.tripDate ? data.tripDate.toISOString() : null,
    updatedAt: data.updatedAt.toISOString(),
  };
}

/**
 * Register tracking endpoints: GET bus tracking and POST position update.
 * GET requires authentication. POST requires DRIVER role with bus assignment.
 */
async function trackingRoutes(app: FastifyInstance): Promise<void> {
  const trackingService = new TrackingService(getPrisma());

  // GET /api/v1/tracking/:busId — get bus live position
  app.get('/api/v1/tracking/:busId', { preHandler: [app.authenticate, noCache] }, async (request) => {
    const { busId } = busIdParamSchema.parse(request.params);
    const tracking = await trackingService.getByBusId(busId);

    if (!tracking) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'No tracking data found for this bus');
    }

    return { data: serializeTrackingData(tracking) };
  });

  // POST /api/v1/tracking — update bus GPS position (DRIVER role)
  app.post('/api/v1/tracking', { preHandler: [app.authenticate] }, async (request) => {
    if (request.user.role !== 'DRIVER') {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only drivers can update tracking');
    }

    const body = trackingUpdateSchema.parse(request.body);
    const tracking = await trackingService.updatePosition(request.user.id, body);

    return { data: serializeTrackingData(tracking) };
  });
}

export default fp(trackingRoutes, {
  name: 'tracking-routes',
  dependencies: ['auth'],
});
