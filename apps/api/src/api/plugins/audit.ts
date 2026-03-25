import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { AuditService } from '@/application/services/audit.service.js';
import type { AuditAction } from '@/domain/audit/audit-actions.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';

// Fastify type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Log an audit event with IP and user agent automatically extracted from the request.
     * Fire-and-forget — never blocks the response.
     */
    audit: (
      action: AuditAction,
      resource: string,
      resourceId?: string | null,
      metadata?: Record<string, unknown> | null,
    ) => void;
  }
}

/**
 * Extract the client IP address from the request.
 * Checks x-forwarded-for header first (for proxied requests), then falls back to socket address.
 */
function extractIpAddress(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.ip;
}

/**
 * Fastify plugin that decorates each request with an `audit()` helper method.
 * Automatically extracts IP address and user agent from the request context.
 */
async function auditPlugin(app: FastifyInstance): Promise<void> {
  const auditService = new AuditService(getPrisma());

  app.decorateRequest('audit', null as unknown as FastifyRequest['audit']);

  app.addHook('onRequest', async (request) => {
    const ipAddress = extractIpAddress(request);
    const userAgent = request.headers['user-agent'] ?? null;

    request.audit = (
      action: AuditAction,
      resource: string,
      resourceId?: string | null,
      metadata?: Record<string, unknown> | null,
    ): void => {
      auditService.log({
        userId: request.user?.id ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        ipAddress,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
        metadata,
      });
    };
  });
}

export default fp(auditPlugin, {
  name: 'audit',
  dependencies: ['auth'],
});
