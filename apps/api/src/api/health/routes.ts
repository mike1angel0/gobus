import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getPrisma } from '@/infrastructure/prisma/client.js';

/**
 * Check database connectivity by executing a simple query.
 * Returns 'up' if reachable, 'down' otherwise.
 */
async function checkDatabase(): Promise<'up' | 'down'> {
  try {
    const prisma = getPrisma();
    await prisma.$queryRawUnsafe('SELECT 1');
    return 'up';
  } catch {
    return 'down';
  }
}

/**
 * Register health check routes.
 *
 * Provides three endpoints:
 * - `GET /health` — detailed status with db connectivity, memory usage, and environment
 * - `GET /health/ready` — readiness probe; returns 503 if database is unreachable
 * - `GET /health/live` — liveness probe; always returns 200
 */
async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const dbStatus = await checkDatabase();
    const mem = process.memoryUsage();

    return {
      status: dbStatus === 'up' ? ('ok' as const) : ('degraded' as const),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      database: dbStatus,
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
      },
    };
  });

  app.get('/health/ready', async (_request, reply) => {
    const dbStatus = await checkDatabase();

    if (dbStatus === 'down') {
      return reply.status(503).send({
        status: 'not_ready' as const,
        timestamp: new Date().toISOString(),
        database: 'down',
      });
    }

    return {
      status: 'ready' as const,
      timestamp: new Date().toISOString(),
      database: 'up',
    };
  });

  app.get('/health/live', async () => {
    return {
      status: 'alive' as const,
      timestamp: new Date().toISOString(),
    };
  });
}

export default fp(healthRoutes, { name: 'health-routes' });
