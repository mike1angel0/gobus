import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupTokens } from './token-cleanup.js';

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('cleanupTokens', () => {
  let mockPrisma: {
    refreshToken: { deleteMany: ReturnType<typeof vi.fn> };
    passwordResetToken: { deleteMany: ReturnType<typeof vi.fn> };
    user: { updateMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    mockPrisma = {
      refreshToken: { deleteMany: vi.fn() },
      passwordResetToken: { deleteMany: vi.fn() },
      user: { updateMany: vi.fn() },
    };
  });

  it('deletes expired refresh tokens', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    const result = await cleanupTokens(mockPrisma as never);

    expect(result.expiredRefreshTokens).toBe(5);
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('deletes used and expired password reset tokens', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    const result = await cleanupTokens(mockPrisma as never);

    expect(result.expiredResetTokens).toBe(3);
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ usedAt: { not: null } }, { expiresAt: { lt: expect.any(Date) } }],
      },
    });
  });

  it('unlocks accounts past their lockout period', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 2 });

    const result = await cleanupTokens(mockPrisma as never);

    expect(result.unlockedAccounts).toBe(2);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'LOCKED',
        lockedUntil: { lt: expect.any(Date) },
      },
      data: {
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  });

  it('returns all counts combined', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 10 });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 7 });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await cleanupTokens(mockPrisma as never);

    expect(result).toEqual({
      expiredRefreshTokens: 10,
      expiredResetTokens: 7,
      unlockedAccounts: 1,
    });
  });

  it('returns zero counts when nothing to clean', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    const result = await cleanupTokens(mockPrisma as never);

    expect(result).toEqual({
      expiredRefreshTokens: 0,
      expiredResetTokens: 0,
      unlockedAccounts: 0,
    });
  });

  it('uses current time for expiry comparison', async () => {
    const before = new Date();
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    await cleanupTokens(mockPrisma as never);
    const after = new Date();

    const refreshCall = mockPrisma.refreshToken.deleteMany.mock.calls[0][0];
    const tokenTime = refreshCall.where.expiresAt.lt as Date;
    expect(tokenTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(tokenTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
