import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { OpenAPIV3 } from 'openapi-types';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import errorHandler from '@/api/plugins/error-handler.js';
import authPlugin from '@/api/plugins/auth.js';
import healthRoutes from '@/api/health/routes.js';
import authRoutes from '@/api/auth/routes.js';
import providerRoutes from '@/api/providers/routes.js';
import routeRoutes from '@/api/routes/routes.js';
import busRoutes from '@/api/buses/routes.js';
import driverRoutes from '@/api/drivers/routes.js';

/**
 * Load the bundled OpenAPI spec from spec/dist/openapi.json.
 *
 * Resolves the path relative to the project root (two levels up from src/).
 */
function loadOpenApiSpec(): OpenAPIV3.Document {
  const specPath = resolve(__dirname, '..', '..', '..', 'spec', 'dist', 'openapi.json');
  const raw = readFileSync(specPath, 'utf-8');
  return JSON.parse(raw) as OpenAPIV3.Document;
}

/**
 * Build and configure the Fastify application instance.
 *
 * Registers core plugins (error handler, swagger, health routes)
 * and returns a ready-to-use app.
 * Use this factory in both production server and tests.
 */
export async function buildApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    ...options,
  });

  await app.register(errorHandler);

  // Swagger / OpenAPI docs
  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: loadOpenApiSpec(),
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Plugins
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(providerRoutes);
  await app.register(routeRoutes);
  await app.register(busRoutes);
  await app.register(driverRoutes);

  return app;
}
