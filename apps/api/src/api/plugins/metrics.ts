import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('Metrics');

/** Threshold in milliseconds above which a request is logged as slow. */
const SLOW_REQUEST_THRESHOLD_MS = 5000;

/** Interval in milliseconds between periodic summary stat logs in production. */
const SUMMARY_INTERVAL_MS = 60_000;

/** Tracked metrics counters for request timing and error rates. */
interface MetricsState {
  /** Total number of requests processed since last summary. */
  requestCount: number;
  /** Total response time in ms across all requests since last summary. */
  totalResponseTime: number;
  /** Error count grouped by HTTP status code since last summary. */
  errorCountByStatus: Map<number, number>;
  /** All response times recorded since last summary (for percentile calculation). */
  responseTimes: number[];
}

/**
 * Create a fresh metrics state with zeroed counters.
 */
function createMetricsState(): MetricsState {
  return {
    requestCount: 0,
    totalResponseTime: 0,
    errorCountByStatus: new Map(),
    responseTimes: [],
  };
}

/**
 * Calculate the p-th percentile from a sorted array of numbers.
 * @param sorted - Array of numbers sorted ascending.
 * @param p - Percentile to calculate (0–100).
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Build a summary object from the current metrics state.
 */
function buildSummary(state: MetricsState): Record<string, unknown> {
  const sorted = [...state.responseTimes].sort((a, b) => a - b);
  const errors: Record<string, number> = {};
  for (const [status, count] of state.errorCountByStatus) {
    errors[String(status)] = count;
  }

  return {
    requestCount: state.requestCount,
    avgResponseTime: state.requestCount > 0
      ? Math.round((state.totalResponseTime / state.requestCount) * 100) / 100
      : 0,
    p50: Math.round(percentile(sorted, 50) * 100) / 100,
    p95: Math.round(percentile(sorted, 95) * 100) / 100,
    p99: Math.round(percentile(sorted, 99) * 100) / 100,
    errorCountByStatus: errors,
  };
}

/**
 * Register the metrics plugin.
 *
 * Tracks per-request timing, error rates by status code, and logs slow requests.
 * In production, logs a periodic summary of request statistics every 60 seconds.
 */
async function metricsPlugin(app: FastifyInstance): Promise<void> {
  let state = createMetricsState();
  let intervalHandle: ReturnType<typeof setInterval> | undefined;

  // Track timing and errors on every response
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = reply.elapsedTime;

    state.requestCount++;
    state.totalResponseTime += responseTime;
    state.responseTimes.push(responseTime);

    if (reply.statusCode >= 400) {
      const current = state.errorCountByStatus.get(reply.statusCode) ?? 0;
      state.errorCountByStatus.set(reply.statusCode, current + 1);
    }

    // Log slow requests
    if (responseTime > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn('slow request detected', {
        method: request.method,
        url: request.url,
        responseTime: Math.round(responseTime * 100) / 100,
        requestId: request.id,
      });
    }
  });

  // Periodic summary in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    intervalHandle = setInterval(() => {
      if (state.requestCount > 0) {
        logger.info('metrics summary', buildSummary(state));
      }
      state = createMetricsState();
    }, SUMMARY_INTERVAL_MS);

    // Ensure the interval doesn't prevent process exit
    intervalHandle.unref();
  }

  // Clean up interval on app close
  app.addHook('onClose', async () => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
    }
  });
}

export default fp(metricsPlugin, {
  name: 'metrics',
});

// Exported for testing
export { createMetricsState, percentile, buildSummary, SLOW_REQUEST_THRESHOLD_MS, type MetricsState };
