import { PrismaClient } from '@/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '@/infrastructure/config/env.js';

let _prisma: PrismaClient | undefined;

/**
 * Return the singleton Prisma client instance, creating it on first access.
 * Uses the @prisma/adapter-pg driver adapter for direct PostgreSQL connections.
 */
export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const env = getEnv();
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

    _prisma = new PrismaClient({
      adapter,
      log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
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
