import type { PrismaClient } from '@/generated/prisma/client.js';
import { getPrisma, disconnectPrisma } from '@/infrastructure/prisma/client.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('TokenCleanup');

/** Result of a token cleanup run with counts of deleted/updated records. */
export interface CleanupResult {
  /** Number of expired refresh tokens deleted. */
  expiredRefreshTokens: number;
  /** Number of used or expired password reset tokens deleted. */
  expiredResetTokens: number;
  /** Number of accounts unlocked past their lockout period. */
  unlockedAccounts: number;
}

/**
 * Delete expired refresh tokens, expired/used password reset tokens,
 * and unlock accounts past their lockout period.
 * Return counts of affected records for logging and testing.
 */
export async function cleanupTokens(prisma: PrismaClient): Promise<CleanupResult> {
  const now = new Date();

  // Delete expired refresh tokens (expiresAt in the past)
  const expiredRefresh = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Delete used or expired password reset tokens
  const expiredReset = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }],
    },
  });

  // Unlock accounts past their lockout period
  const unlocked = await prisma.user.updateMany({
    where: {
      status: 'LOCKED',
      lockedUntil: { lt: now },
    },
    data: {
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const result: CleanupResult = {
    expiredRefreshTokens: expiredRefresh.count,
    expiredResetTokens: expiredReset.count,
    unlockedAccounts: unlocked.count,
  };

  logger.info('Token cleanup completed', {
    expiredRefreshTokens: result.expiredRefreshTokens,
    expiredResetTokens: result.expiredResetTokens,
    unlockedAccounts: result.unlockedAccounts,
  });

  return result;
}

/**
 * Run the token cleanup job as a standalone script.
 * Connect to the database, execute cleanup, then disconnect.
 */
async function main(): Promise<void> {
  logger.info('Starting token cleanup job');

  try {
    const prisma = getPrisma();
    const result = await cleanupTokens(prisma);

    logger.info('Token cleanup job finished', {
      expiredRefreshTokens: result.expiredRefreshTokens,
      expiredResetTokens: result.expiredResetTokens,
      unlockedAccounts: result.unlockedAccounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Token cleanup job failed', { error: message });
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
}

main();
