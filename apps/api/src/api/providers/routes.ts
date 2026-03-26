import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { ProviderService } from '@/application/services/provider.service.js';
import type { ProviderEntity } from '@/domain/providers/provider.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { requireProvider } from '@/api/plugins/role-guard.js';
import { privateNoCache } from '@/api/plugins/cache-control.js';

/**
 * Serialize a ProviderEntity to a JSON-safe response object.
 * Converts Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeProvider(provider: ProviderEntity): Record<string, unknown> {
  return {
    ...provider,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
  };
}

/**
 * Register all provider routes under the /api/v1/providers prefix.
 * Implements GET /api/v1/providers/me from the OpenAPI spec.
 */
async function providerRoutes(app: FastifyInstance): Promise<void> {
  const providerService = new ProviderService(getPrisma());

  // GET /api/v1/providers/me
  app.get(
    '/api/v1/providers/me',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const provider = await providerService.getByUserId(request.user.id);

      return { data: serializeProvider(provider) };
    },
  );

  // GET /api/v1/provider/analytics
  app.get(
    '/api/v1/provider/analytics',
    { preHandler: [app.authenticate, requireProvider, privateNoCache] },
    async (request) => {
      const analytics = await providerService.getAnalytics(request.user.providerId!);

      return { data: analytics };
    },
  );
}

export default fp(providerRoutes, {
  name: 'provider-routes',
  dependencies: ['auth'],
});
