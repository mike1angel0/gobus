import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';

// Mock the logger to avoid output in tests
vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    provider: {
      create: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((actions: unknown[]) => Promise.all(actions)),
  } as unknown as Parameters<
    typeof AuthService extends new (p: infer P) => unknown ? (p: P) => void : never
  >[0];
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: bcrypt.hashSync('Password1', 4), // Low rounds for test speed
    role: 'PASSENGER' as const,
    phone: null,
    avatarUrl: null,
    preferences: null,
    providerId: null,
    status: 'ACTIVE' as const,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AuthService(prisma as never);
  });

  // ─── register ──────────────────────────────────────────────────────

  describe('register', () => {
    it('should register a PASSENGER user with valid data', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeUser({ id: 'new-user-1', email: 'new@example.com' }),
      );
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.register({
        email: 'new@example.com',
        password: 'StrongPass1',
        name: 'New User',
        role: 'PASSENGER',
      });

      expect(result.user.id).toBe('new-user-1');
      expect(result.user.email).toBe('new@example.com');
      expect(result.user.role).toBe('PASSENGER');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalledOnce();
    });

    it('should register a PROVIDER user and create provider entity', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.provider.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'provider-1',
        name: 'Bus Co',
      });
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeUser({ id: 'new-user-2', role: 'PROVIDER', providerId: 'provider-1' }),
      );
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.register({
        email: 'provider@example.com',
        password: 'StrongPass1',
        name: 'Provider Admin',
        role: 'PROVIDER',
        providerName: 'Bus Co',
      });

      expect(result.user.role).toBe('PROVIDER');
      expect(result.user.providerId).toBe('provider-1');
      expect(prisma.provider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Bus Co' }),
        }),
      );
    });

    it('should throw 409 when email is already taken', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'StrongPass1',
          name: 'Dupe User',
          role: 'PASSENGER',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 409,
          code: ErrorCodes.AUTH_EMAIL_TAKEN,
        }),
      );
    });

    it('should throw 400 for weak password (no uppercase)', async () => {
      await expect(
        service.register({
          email: 'new@example.com',
          password: 'weakpass1',
          name: 'User',
          role: 'PASSENGER',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.VALIDATION_ERROR,
        }),
      );
    });

    it('should throw 400 for weak password (no digit)', async () => {
      await expect(
        service.register({
          email: 'new@example.com',
          password: 'WeakPassword',
          name: 'User',
          role: 'PASSENGER',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.VALIDATION_ERROR,
        }),
      );
    });

    it('should throw 400 for weak password (too short)', async () => {
      await expect(
        service.register({
          email: 'new@example.com',
          password: 'Short1',
          name: 'User',
          role: 'PASSENGER',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.VALIDATION_ERROR,
        }),
      );
    });

    it('should throw 400 when PROVIDER role lacks providerName', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.register({
          email: 'provider@example.com',
          password: 'StrongPass1',
          name: 'Provider Admin',
          role: 'PROVIDER',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.VALIDATION_ERROR,
        }),
      );
    });
  });

  // ─── login ────────────────────────────────────────────────────────

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const user = makeUser();
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(user);
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password1',
      });

      expect(result.user.id).toBe('user-1');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it('should return 401 for non-existent email', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@example.com', password: 'Password1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        }),
      );
    });

    it('should return 401 for wrong password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        }),
      );
    });

    it('should increment failedLoginAttempts on wrong password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(AppError);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 1 }),
        }),
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      const user = makeUser({ failedLoginAttempts: 4 });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(user);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 423,
          code: ErrorCodes.ACCOUNT_LOCKED,
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            status: 'LOCKED',
          }),
        }),
      );
    });

    it('should return 423 for currently locked account', async () => {
      const user = makeUser({
        status: 'LOCKED',
        lockedUntil: new Date(Date.now() + 600_000), // 10 min in future
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(user);

      await expect(
        service.login({ email: 'test@example.com', password: 'Password1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 423,
          code: ErrorCodes.ACCOUNT_LOCKED,
        }),
      );
    });

    it('should return 403 for suspended account', async () => {
      const user = makeUser({ status: 'SUSPENDED' });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(user);

      await expect(
        service.login({ email: 'test@example.com', password: 'Password1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 403,
          code: ErrorCodes.ACCOUNT_SUSPENDED,
        }),
      );
    });

    it('should reset failed attempts on successful login', async () => {
      const user = makeUser({ failedLoginAttempts: 3 });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(user);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.login({ email: 'test@example.com', password: 'Password1' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0, status: 'ACTIVE' }),
        }),
      );
    });

    it('should unlock expired lockout on login attempt', async () => {
      const user = makeUser({
        status: 'LOCKED',
        lockedUntil: new Date(Date.now() - 60_000), // 1 min in past
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(user);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password1',
      });

      expect(result.user.id).toBe('user-1');
    });
  });

  // ─── logout ───────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      const tokenHash = createHash('sha256').update('valid-token').digest('hex');
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'rt-1',
        token: tokenHash,
        userId: 'user-1',
        revokedAt: null,
      });
      (prisma.refreshToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.logout('user-1', 'valid-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('should silently succeed if token not found', async () => {
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.logout('user-1', 'unknown-token')).resolves.toBeUndefined();
    });

    it('should not revoke if userId does not match', async () => {
      const tokenHash = createHash('sha256').update('token').digest('hex');
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'rt-1',
        token: tokenHash,
        userId: 'other-user',
        revokedAt: null,
      });

      await service.logout('user-1', 'token');

      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  // ─── refreshToken ─────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('should rotate tokens successfully', async () => {
      const user = makeUser();
      const tokenHash = createHash('sha256').update('refresh-token').digest('hex');
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'rt-1',
        token: tokenHash,
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
        user,
      });
      (prisma.refreshToken.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.refreshToken('refresh-token');

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      // Old token revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      // New token created
      expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
    });

    it('should throw 401 for non-existent token', async () => {
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.AUTH_TOKEN_EXPIRED,
        }),
      );
    });

    it('should throw 401 and revoke all tokens on reuse of revoked token', async () => {
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
        user: makeUser(),
      });
      (prisma.refreshToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(service.refreshToken('reused-token')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.AUTH_TOKEN_EXPIRED,
        }),
      );

      // All user tokens should be revoked (security measure)
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', revokedAt: null }),
        }),
      );
    });

    it('should throw 401 for expired token', async () => {
      (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
        user: makeUser(),
      });

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.AUTH_TOKEN_EXPIRED,
        }),
      );
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should create a reset token for existing user', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
      (prisma.passwordResetToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(service.forgotPassword('test@example.com')).resolves.toBeUndefined();

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            token: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should silently succeed for non-existent email (no enumeration)', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.forgotPassword('missing@example.com')).resolves.toBeUndefined();

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const tokenHash = createHash('sha256').update('reset-token').digest('hex');
      (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'prt-1',
        token: tokenHash,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await expect(service.resetPassword('reset-token', 'NewPassword1')).resolves.toBeUndefined();

      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it('should throw 400 for invalid token', async () => {
      (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', 'NewPassword1')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.AUTH_INVALID_RESET_TOKEN,
        }),
      );
    });

    it('should throw 400 for already used token', async () => {
      (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: new Date(), // Already used
      });

      await expect(service.resetPassword('used-token', 'NewPassword1')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.AUTH_INVALID_RESET_TOKEN,
        }),
      );
    });

    it('should throw 400 for expired token', async () => {
      (prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000), // Expired
        usedAt: null,
      });

      await expect(service.resetPassword('expired-token', 'NewPassword1')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.AUTH_INVALID_RESET_TOKEN,
        }),
      );
    });

    it('should throw 400 for weak new password', async () => {
      await expect(service.resetPassword('any-token', 'weak')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.VALIDATION_ERROR,
        }),
      );
    });
  });

  // ─── changePassword ───────────────────────────────────────────────

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await expect(
        service.changePassword('user-1', 'Password1', 'NewPassword1'),
      ).resolves.toBeUndefined();

      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it('should throw 401 if current password is wrong', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());

      await expect(
        service.changePassword('user-1', 'WrongPassword1', 'NewPassword1'),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        }),
      );
    });

    it('should throw 401 if user not found', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.changePassword('missing-user', 'Password1', 'NewPassword1'),
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        }),
      );
    });

    it('should throw 400 for weak new password', async () => {
      await expect(service.changePassword('user-1', 'Password1', 'weak')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCodes.VALIDATION_ERROR,
        }),
      );
    });
  });

  // ─── generateTokens ──────────────────────────────────────────────

  describe('generateTokens', () => {
    it('should generate valid JWT access token and store hashed refresh token', async () => {
      (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const user = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'PASSENGER' as const,
        providerId: null,
      };

      const tokens = await service.generateTokens(user);

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.refreshToken.length).toBe(80); // 40 bytes hex

      // Verify JWT payload
      const decoded = jwt.verify(
        tokens.accessToken,
        process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod',
      ) as Record<string, unknown>;
      expect(decoded.sub).toBe('user-1');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('PASSENGER');
      expect(decoded.providerId).toBeNull();

      // Verify refresh token is stored as hash (not plaintext)
      const createCall = (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.token).not.toBe(tokens.refreshToken);
      expect(createCall.data.token.length).toBe(64); // SHA-256 hex
    });
  });
});
