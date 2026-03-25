import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('parseEnv', () => {
  function stubAllValid() {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/test');
    vi.stubEnv('JWT_SECRET', 'a-very-long-secret-key-123');
    vi.stubEnv('JWT_REFRESH_SECRET', 'another-long-secret-key-456');
    vi.stubEnv('NODE_ENV', 'test');
  }

  beforeEach(() => {
    vi.resetModules();
  });

  it('parses valid environment variables', async () => {
    stubAllValid();
    vi.stubEnv('PORT', '4000');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:5173');

    const { parseEnv } = await import('./env.js');
    const env = parseEnv();

    expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/test');
    expect(env.JWT_SECRET).toBe('a-very-long-secret-key-123');
    expect(env.JWT_REFRESH_SECRET).toBe('another-long-secret-key-456');
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('production');
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('applies defaults for PORT and CORS_ORIGIN', async () => {
    stubAllValid();
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;

    const { parseEnv } = await import('./env.js');
    const env = parseEnv();

    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toBe('http://localhost:3001');
  });

  it('throws when DATABASE_URL is missing', async () => {
    stubAllValid();
    delete process.env.DATABASE_URL;

    const { parseEnv } = await import('./env.js');
    expect(() => parseEnv()).toThrow('Invalid environment variables');
  });

  it('throws when JWT_SECRET is too short', async () => {
    stubAllValid();
    vi.stubEnv('JWT_SECRET', 'short');

    const { parseEnv } = await import('./env.js');
    expect(() => parseEnv()).toThrow('Invalid environment variables');
  });

  it('throws when NODE_ENV is invalid', async () => {
    stubAllValid();
    vi.stubEnv('NODE_ENV', 'staging');

    const { parseEnv } = await import('./env.js');
    expect(() => parseEnv()).toThrow('Invalid environment variables');
  });

  it('coerces PORT string to number', async () => {
    stubAllValid();
    vi.stubEnv('PORT', '8080');

    const { parseEnv } = await import('./env.js');
    const env = parseEnv();
    expect(env.PORT).toBe(8080);
  });

  it('throws when PORT exceeds max', async () => {
    stubAllValid();
    vi.stubEnv('PORT', '70000');

    const { parseEnv } = await import('./env.js');
    expect(() => parseEnv()).toThrow('Invalid environment variables');
  });
});
