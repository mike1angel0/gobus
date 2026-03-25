import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PrismaClient, User } from '@/generated/prisma/client.js';
import { Prisma } from '@/generated/prisma/client.js';
import type {
  RegisterData,
  LoginCredentials,
  AuthTokenPayload,
  TokenPair,
} from '@/domain/auth/auth.types.js';
import type { UserEntity, UserUpdateData } from '@/domain/users/user.entity.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { getEnv } from '@/infrastructure/config/env.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('AuthService');

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Authentication service handling user registration, login, token management,
 * and password operations with security features (lockout, hashing, rotation).
 */
export class AuthService {
  /** Create an auth service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Register a new user account. Creates a provider entity when role is PROVIDER.
   * Returns the created user and JWT token pair.
   */
  async register(data: RegisterData): Promise<{ user: UserEntity; tokens: TokenPair }> {
    this.validatePasswordStrength(data.password);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, ErrorCodes.AUTH_EMAIL_TAKEN, 'Email address is already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    let providerId: string | undefined;

    if (data.role === 'PROVIDER') {
      if (!data.providerName) {
        throw new AppError(
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Provider name is required for PROVIDER role',
        );
      }

      const provider = await this.prisma.provider.create({
        data: {
          name: data.providerName,
          contactEmail: data.email,
          contactPhone: data.phone ?? null,
        },
      });
      providerId = provider.id;
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: data.role,
        phone: data.phone ?? null,
        providerId: providerId ?? null,
      },
    });

    const tokens = await this.generateTokens(user);

    logger.info('User registered', { userId: user.id, role: user.role });

    return { user: this.toUserEntity(user), tokens };
  }

  /**
   * Authenticate a user with email and password. Enforces account lockout
   * after 5 failed attempts (15-minute lockout). Returns user and tokens on success.
   */
  async login(
    credentials: LoginCredentials,
    ipAddress?: string,
  ): Promise<{ user: UserEntity; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (!user) {
      // Perform a dummy hash to prevent timing attacks
      await bcrypt.hash('dummy', BCRYPT_ROUNDS);
      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Check suspended status
    if (user.status === 'SUSPENDED') {
      throw new AppError(403, ErrorCodes.ACCOUNT_SUSPENDED, 'Account is suspended');
    }

    // Check lockout
    if (user.status === 'LOCKED' && user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        423,
        ErrorCodes.ACCOUNT_LOCKED,
        'Account is locked due to too many failed login attempts',
      );
    }

    // If lockout has expired, reset status
    if (user.status === 'LOCKED' && user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

    if (!isPasswordValid) {
      const failedAttempts = user.failedLoginAttempts + 1;

      if (failedAttempts >= LOCKOUT_THRESHOLD) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: failedAttempts,
            status: 'LOCKED',
            lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
          },
        });

        logger.warn('Account locked after failed attempts', {
          userId: user.id,
          failedAttempts,
          ipAddress,
        });

        throw new AppError(
          423,
          ErrorCodes.ACCOUNT_LOCKED,
          'Account is locked due to too many failed login attempts',
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: failedAttempts },
      });

      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Successful login — reset failed attempts
    if (user.failedLoginAttempts > 0 || user.status === 'LOCKED') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, status: 'ACTIVE', lockedUntil: null },
      });
    }

    const tokens = await this.generateTokens(user);

    logger.info('User logged in', { userId: user.id, ipAddress });

    return { user: this.toUserEntity(user), tokens };
  }

  /**
   * Revoke a specific refresh token, logging the user out of that session.
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (storedToken && storedToken.userId === userId && !storedToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
    }

    logger.debug('User logged out', { userId });
  }

  /**
   * Validate a refresh token and issue a new token pair (rotation).
   * The old refresh token is revoked and a new one is issued.
   */
  async refreshToken(token: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(token);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new AppError(401, ErrorCodes.AUTH_TOKEN_EXPIRED, 'Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      // Possible token reuse attack — revoke all tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      logger.warn('Refresh token reuse detected', { userId: storedToken.userId });

      throw new AppError(401, ErrorCodes.AUTH_TOKEN_EXPIRED, 'Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AppError(401, ErrorCodes.AUTH_TOKEN_EXPIRED, 'Refresh token has expired');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Issue new tokens
    const newTokens = await this.generateTokens(storedToken.user);

    logger.debug('Tokens refreshed', { userId: storedToken.userId });

    return newTokens;
  }

  /**
   * Generate a password reset token for the given email address.
   * Always returns void to prevent email enumeration (timing-safe).
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Simulate work to prevent timing attacks
      randomBytes(32);
      createHash('sha256').update(randomBytes(32)).digest('hex');
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        token: tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
      },
    });

    // In production, send email with rawToken. For now, log it in non-prod.
    logger.info('Password reset requested', { userId: user.id });
    logger.debug('Reset token generated', { userId: user.id, token: rawToken });
  }

  /**
   * Reset a user's password using a valid reset token.
   * Validates token (exists, not expired, not used), updates password,
   * marks token as used, and revokes all existing refresh tokens.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.validatePasswordStrength(newPassword);

    const tokenHash = this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!resetToken) {
      throw new AppError(
        400,
        ErrorCodes.AUTH_INVALID_RESET_TOKEN,
        'Invalid or expired password reset token',
      );
    }

    if (resetToken.usedAt) {
      throw new AppError(
        400,
        ErrorCodes.AUTH_INVALID_RESET_TOKEN,
        'Password reset token has already been used',
      );
    }

    if (resetToken.expiresAt < new Date()) {
      throw new AppError(
        400,
        ErrorCodes.AUTH_INVALID_RESET_TOKEN,
        'Password reset token has expired',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password, mark token used, revoke all refresh tokens in a transaction
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, failedLoginAttempts: 0, status: 'ACTIVE', lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    logger.info('Password reset completed', { userId: resetToken.userId });
  }

  /**
   * Change the password for an authenticated user.
   * Validates the current password, enforces password strength,
   * and revokes all other refresh tokens (forces re-login elsewhere).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    this.validatePasswordStrength(newPassword);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    logger.info('Password changed', { userId });
  }

  /**
   * Generate a JWT access token and a refresh token for the given user.
   * The refresh token is stored as a SHA-256 hash in the database.
   */
  async generateTokens(
    user: Pick<User, 'id' | 'email' | 'role' | 'providerId'>,
  ): Promise<TokenPair> {
    const env = getEnv();

    const payload: Omit<AuthTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      providerId: user.providerId,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshTokenRaw = randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashToken(refreshTokenRaw);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
    };
  }

  /**
   * Retrieve the authenticated user's profile by ID.
   * Returns a public UserEntity (excludes sensitive fields).
   */
  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'User not found');
    }

    return this.toUserEntity(user);
  }

  /**
   * Update the authenticated user's profile. Only provided fields are updated.
   * Returns the updated public UserEntity.
   */
  async updateProfile(userId: string, data: UserUpdateData): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.preferences !== undefined && {
          preferences: data.preferences as Prisma.InputJsonValue,
        }),
      },
    });

    logger.info('Profile updated', { userId });

    return this.toUserEntity(updated);
  }

  /**
   * Validate that a password meets strength requirements:
   * min 8 characters, at least one uppercase, one lowercase, one digit.
   */
  private validatePasswordStrength(password: string): void {
    if (!PASSWORD_REGEX.test(password)) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Password must be at least 8 characters and contain uppercase, lowercase, and a digit',
      );
    }
  }

  /**
   * Hash a token string using SHA-256 for secure storage.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Convert a Prisma User record to a public UserEntity (excludes sensitive fields).
   */
  private toUserEntity(user: User): UserEntity {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      preferences: user.preferences as UserEntity['preferences'],
      providerId: user.providerId,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
