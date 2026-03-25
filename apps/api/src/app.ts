import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

/**
 * Build and configure the Fastify application instance.
 *
 * Registers core plugins and returns a ready-to-use app.
 * Use this factory in both production server and tests.
 */
export async function buildApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    ...options,
  });

  return app;
}
