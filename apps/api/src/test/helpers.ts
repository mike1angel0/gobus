import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { buildApp } from '@/app.js';

/** Payload embedded in JWT tokens during tests. */
export interface TestTokenPayload {
  sub: string;
  email: string;
  role: string;
  providerId?: string | null;
}

/** Overrides for creating test user data. */
export interface TestUserOverrides {
  id?: string;
  email?: string;
  name?: string;
  role?: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  providerId?: string | null;
  phone?: string | null;
  status?: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
}

/** Shape returned by createTestUser. */
export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  providerId: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  createdAt: Date;
  updatedAt: Date;
}

let testUserCounter = 0;

/**
 * Build a Fastify application configured for testing.
 *
 * Disables logging and applies test-friendly settings.
 * The caller is responsible for closing the app after use.
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: false,
  });
  return app;
}

/**
 * Create an Authorization header with a signed JWT for testing.
 *
 * Returns the full header value: `Bearer <token>`.
 *
 * @param userId - The user ID to embed in the token `sub` claim.
 * @param role - The user role to embed in the token.
 * @param options - Optional email and provider ID for the token.
 */
export function createAuthHeader(
  userId: string,
  role: string,
  options?: { email?: string; providerId?: string | null },
): string {
  const payload: TestTokenPayload = {
    sub: userId,
    email: options?.email ?? `${userId}@test.com`,
    role,
    providerId: options?.providerId ?? null,
  };

  const secret = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';
  const token = jwt.sign({ ...payload, iss: 'transio-api', aud: 'transio-client' }, secret, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
  return `Bearer ${token}`;
}

/**
 * Create a test user object with sensible defaults.
 *
 * Generates unique email and name based on an incrementing counter.
 * Does NOT persist to the database — returns plain data for mocking.
 *
 * @param overrides - Optional fields to override the default values.
 */
export function createTestUser(overrides: TestUserOverrides = {}): TestUser {
  testUserCounter++;
  const now = new Date();

  return {
    id: overrides.id ?? `test-user-${testUserCounter}`,
    email: overrides.email ?? `testuser${testUserCounter}@example.com`,
    name: overrides.name ?? `Test User ${testUserCounter}`,
    role: overrides.role ?? 'PASSENGER',
    providerId: overrides.providerId ?? null,
    phone: overrides.phone ?? null,
    status: overrides.status ?? 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}
