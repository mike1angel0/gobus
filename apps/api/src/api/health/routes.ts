import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Register health check routes.
 *
 * Provides a `GET /health` endpoint that returns server status,
 * current timestamp, and uptime in seconds.
 */
async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}

export default fp(healthRoutes, { name: 'health-routes' });
