import { randomBytes, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { User } from '@/generated/prisma/client.js';
import type { RegisterData, AuthTokenPayload, TokenPair } from '@/domain/auth/auth.types.js';
import type { UserEntity } from '@/domain/users/user.entity.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { getEnv } from '@/infrastructure/config/env.js';

/** Number of bcrypt hashing rounds for password storage. */
export const BCRYPT_ROUNDS = 12;

/** Access token validity period. */
export const ACCESS_TOKEN_EXPIRY = '15m';

/** Refresh token validity in days. */
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/** Number of failed login attempts before account lockout. */
export const LOCKOUT_THRESHOLD = 5;

/** Duration of account lockout in milliseconds (15 minutes). */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Password reset token validity in milliseconds (1 hour). */
export const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/** Regex enforcing minimum password strength: 8+ chars, upper, lower, digit. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/** JWT issuer claim identifying this service. */
export const JWT_ISSUER = 'gobus-api';

/** JWT audience claim identifying intended recipients. */
export const JWT_AUDIENCE = 'gobus-client';

/**
 * Compare two strings in constant time to prevent timing attacks.
 * Uses crypto.timingSafeEqual internally, handling unequal-length strings safely.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Compare against a same-length dummy to avoid leaking length info via timing
    const dummy = Buffer.alloc(bufA.length);
    timingSafeEqual(bufA, dummy);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validate that a password meets strength requirements:
 * min 8 characters, at least one uppercase, one lowercase, one digit.
 */
export function validatePasswordStrength(password: string): void {
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
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Convert a Prisma User record to a public UserEntity (excludes sensitive fields).
 */
export function toUserEntity(user: User): UserEntity {
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

/**
 * Build a fake registration response identical in shape to a real one.
 * Tokens and user ID are fake — any attempt to use them will fail gracefully.
 * Prevents account enumeration via registration endpoint.
 */
export function buildFakeRegistrationResponse(data: RegisterData): {
  user: UserEntity;
  tokens: TokenPair;
} {
  const env = getEnv();
  const fakeUserId = randomUUID();
  const now = new Date();

  const payload: Omit<AuthTokenPayload, 'iat' | 'exp' | 'nbf'> = {
    sub: fakeUserId,
    email: data.email,
    role: data.role,
    providerId: null,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    jti: randomUUID(),
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    notBefore: 0,
    algorithm: 'HS256',
  });

  const refreshToken = randomBytes(40).toString('hex');

  return {
    user: {
      id: fakeUserId,
      email: data.email,
      name: data.name,
      role: data.role,
      phone: data.phone ?? null,
      avatarUrl: null,
      preferences: null,
      providerId: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    tokens: { accessToken, refreshToken },
  };
}
