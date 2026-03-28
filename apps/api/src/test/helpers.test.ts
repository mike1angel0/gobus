import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { createTestApp, createAuthHeader, createTestUser } from './helpers.js';
import type { TestTokenPayload } from './helpers.js';

describe('createTestApp', () => {
  it('returns a Fastify instance', async () => {
    const app = await createTestApp();
    expect(app.server).toBeDefined();
    await app.close();
  });
});

describe('createAuthHeader', () => {
  const secret = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

  it('returns a Bearer token string', () => {
    const header = createAuthHeader('user-1', 'PASSENGER');
    expect(header).toMatch(/^Bearer .+/);
  });

  it('embeds userId, email, and role in the JWT payload', () => {
    const header = createAuthHeader('user-1', 'ADMIN');
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'gobus-api',
      audience: 'gobus-client',
    }) as TestTokenPayload;
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.email).toBe('user-1@test.com');
    expect(decoded.providerId).toBeNull();
  });

  it('includes providerId when provided', () => {
    const header = createAuthHeader('user-2', 'PROVIDER', { providerId: 'provider-1' });
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'gobus-api',
      audience: 'gobus-client',
    }) as TestTokenPayload;
    expect(decoded.sub).toBe('user-2');
    expect(decoded.role).toBe('PROVIDER');
    expect(decoded.providerId).toBe('provider-1');
  });

  it('uses custom email when provided', () => {
    const header = createAuthHeader('user-3', 'PASSENGER', { email: 'custom@example.com' });
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'gobus-api',
      audience: 'gobus-client',
    }) as TestTokenPayload;
    expect(decoded.email).toBe('custom@example.com');
  });
});

describe('createTestUser', () => {
  it('creates a user with default values', () => {
    const user = createTestUser();
    expect(user.email).toMatch(/^testuser\d+@example\.com$/);
    expect(user.name).toMatch(/^Test User \d+$/);
    expect(user.role).toBe('PASSENGER');
    expect(user.providerId).toBeNull();
    expect(user.phone).toBeNull();
    expect(user.status).toBe('ACTIVE');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('applies overrides', () => {
    const user = createTestUser({
      id: 'custom-id',
      email: 'custom@example.com',
      name: 'Custom User',
      role: 'ADMIN',
      status: 'SUSPENDED',
    });
    expect(user.id).toBe('custom-id');
    expect(user.email).toBe('custom@example.com');
    expect(user.name).toBe('Custom User');
    expect(user.role).toBe('ADMIN');
    expect(user.status).toBe('SUSPENDED');
  });

  it('generates unique ids and emails across calls', () => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    expect(user1.id).not.toBe(user2.id);
    expect(user1.email).not.toBe(user2.email);
  });
});
