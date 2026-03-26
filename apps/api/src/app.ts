import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { OpenAPIV3 } from 'openapi-types';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import errorHandler from '@/api/plugins/error-handler.js';
import requestLoggerPlugin from '@/api/plugins/request-logger.js';
import rateLimitPlugin from '@/api/plugins/rate-limit.js';
import authPlugin from '@/api/plugins/auth.js';
import auditPlugin from '@/api/plugins/audit.js';
import metricsPlugin from '@/api/plugins/metrics.js';
import sanitizeInputPlugin from '@/api/plugins/sanitize-input.js';
import { getLoggerConfig } from '@/infrastructure/logger/logger.js';
import healthRoutes from '@/api/health/routes.js';
import authRoutes from '@/api/auth/routes.js';
import providerRoutes from '@/api/providers/routes.js';
import routeRoutes from '@/api/routes/routes.js';
import busRoutes from '@/api/buses/routes.js';
import driverRoutes from '@/api/drivers/routes.js';
import scheduleRoutes from '@/api/schedules/routes.js';
import searchRoutes from '@/api/search/routes.js';
import bookingRoutes from '@/api/bookings/routes.js';
import trackingRoutes from '@/api/tracking/routes.js';
import delayRoutes from '@/api/delays/routes.js';
import driverTripRoutes from '@/api/driver-trips/routes.js';
import adminRoutes from '@/api/admin/routes.js';

/** Default localhost origins allowed in development mode. */
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

/**
 * Parse the CORS_ORIGIN environment variable into an array of allowed origins.
 *
 * In development mode, localhost origins are always allowed.
 * In production, only the explicitly configured origins are used.
 */
export function parseCorsOrigins(): string[] {
  const env = process.env.CORS_ORIGIN ?? '';
  const configured = env
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const origins = new Set([...DEV_ORIGINS, ...configured]);
    return [...origins];
  }

  return configured;
}

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
 * Register core middleware plugins: CORS, compression, security headers, error handling,
 * input sanitization, request logging, metrics, rate limiting, and Swagger docs.
 */
async function registerPlugins(app: FastifyInstance): Promise<void> {
  // Propagate x-request-id to responses for request tracing
  app.addHook('onRequest', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  // CORS
  await app.register(cors, {
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
  });

  const isTest = process.env.NODE_ENV === 'test';

  // Response compression (disabled in test to avoid interference with integration tests)
  if (!isTest) {
    await app.register(compress, {
      threshold: 1024, // Only compress responses > 1KB
      encodings: ['br', 'gzip', 'deflate'], // Prefer Brotli, then gzip
    });
  }

  // Security headers (disabled in test to avoid noise in integration tests)
  if (!isTest) {
    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31_536_000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    });

    // Permissions-Policy header (not included in helmet v8)
    app.addHook('onSend', async (_request, reply) => {
      void reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=(self)');
    });
  }

  await app.register(errorHandler);
  await app.register(sanitizeInputPlugin);
  await app.register(requestLoggerPlugin);
  await app.register(metricsPlugin);

  // Rate limiting (disabled in test to avoid interference with integration tests)
  if (!isTest) {
    await app.register(rateLimitPlugin);
  }

  // Swagger / OpenAPI docs (disabled in production to prevent information disclosure)
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    await app.register(swagger, {
      mode: 'static',
      specification: { document: loadOpenApiSpec() },
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  await app.register(authPlugin);
  await app.register(auditPlugin);
}

/**
 * Register all API route handlers on the Fastify instance.
 */
async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(providerRoutes);
  await app.register(routeRoutes);
  await app.register(busRoutes);
  await app.register(driverRoutes);
  await app.register(scheduleRoutes);
  await app.register(searchRoutes);
  await app.register(bookingRoutes);
  await app.register(trackingRoutes);
  await app.register(delayRoutes);
  await app.register(driverTripRoutes);
  await app.register(adminRoutes);
}

/**
 * Build and configure the Fastify application instance.
 *
 * Register core plugins (error handler, swagger, health routes)
 * and return a ready-to-use app.
 * Use this factory in both production server and tests.
 */
export async function buildApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? getLoggerConfig(),
    bodyLimit: 1_048_576, // 1 MB request body size limit
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
    ...options,
  });

  await registerPlugins(app);
  await registerRoutes(app);

  return app;
}
