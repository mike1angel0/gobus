import { PrismaClient } from '@/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '@/infrastructure/config/env.js';
/** Idle connection timeout in milliseconds (30 seconds). */
const IDLE_TIMEOUT_MS = 30_000;

let _prisma: PrismaClient | undefined;

/**
 * Return the singleton Prisma client instance, creating it on first access.
 * Uses the @prisma/adapter-pg driver adapter with configurable connection pooling.
 */
export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const env = getEnv();
    const poolMax = env.DATABASE_POOL_MAX;

    const adapter = new PrismaPg({
      connectionString: env.DATABASE_URL,
      max: poolMax,
      min: 1,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
    });

    _prisma = new PrismaClient({
      adapter,
      log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
      transactionOptions: {
        maxWait: 5000,
        timeout: 10_000,
      },
    });
  }
  return _prisma;
}

/**
 * Disconnect the Prisma client. Call during graceful shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}
