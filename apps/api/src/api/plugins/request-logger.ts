import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('RequestLogger');

/**
 * Register the request logging plugin.
 * Logs method, url, statusCode, responseTime, and requestId for every completed request.
 */
async function requestLoggerPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = reply.elapsedTime;
    const data: Record<string, unknown> = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: Math.round(responseTime * 100) / 100,
      requestId: request.id,
    };

    if (request.user) {
      data.userId = request.user.id;
    }

    if (reply.statusCode >= 500) {
      logger.error('request completed', data);
    } else if (reply.statusCode >= 400) {
      logger.warn('request completed', data);
    } else {
      logger.info('request completed', data);
    }
  });
}

export default fp(requestLoggerPlugin, {
  name: 'request-logger',
});
