import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock PrismaPg to capture constructor args
const mockPrismaPgConstructor = vi.fn();
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class MockPrismaPg {
    constructor(...args: unknown[]) {
      mockPrismaPgConstructor(...args);
    }
  },
}));

// Mock PrismaClient
vi.mock('@/generated/prisma/client.js', () => ({
  PrismaClient: class MockPrismaClient {
    constructor(public opts: unknown) {}
    $disconnect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  },
}));

// Mock logger
vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function stubValidEnv(overrides: Record<string, string> = {}) {
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/test');
  vi.stubEnv('JWT_SECRET', 'a-very-long-secret-key-at-least-32-characters');
  vi.stubEnv('JWT_REFRESH_SECRET', 'another-long-secret-key-different-32-chars');
  vi.stubEnv('NODE_ENV', 'test');
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
}

describe('getPrisma', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPrismaPgConstructor.mockClear();
  });

  it('creates PrismaPg adapter with pool options using default pool max', async () => {
    stubValidEnv();
    delete process.env.DATABASE_POOL_MAX;

    const { getPrisma } = await import('./client.js');
    getPrisma();

    expect(mockPrismaPgConstructor).toHaveBeenCalledOnce();
    const [poolConfig] = mockPrismaPgConstructor.mock.calls[0] as [Record<string, unknown>];
    expect(poolConfig.connectionString).toBe('postgresql://localhost:5432/test');
    expect(poolConfig.max).toBe(10);
    expect(poolConfig.min).toBe(1);
    expect(poolConfig.idleTimeoutMillis).toBe(30_000);
  });

  it('uses DATABASE_POOL_MAX env var for pool max', async () => {
    stubValidEnv({ DATABASE_POOL_MAX: '25' });

    const { getPrisma } = await import('./client.js');
    getPrisma();

    const [poolConfig] = mockPrismaPgConstructor.mock.calls[0] as [Record<string, unknown>];
    expect(poolConfig.max).toBe(25);
  });

  it('returns the same instance on subsequent calls (singleton)', async () => {
    stubValidEnv();

    const { getPrisma } = await import('./client.js');
    const first = getPrisma();
    const second = getPrisma();

    expect(first).toBe(second);
    expect(mockPrismaPgConstructor).toHaveBeenCalledOnce();
  });
});

describe('disconnectPrisma', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPrismaPgConstructor.mockClear();
  });

  it('disconnects and clears the singleton', async () => {
    stubValidEnv();

    const { getPrisma, disconnectPrisma } = await import('./client.js');
    const client = getPrisma();

    await disconnectPrisma();

    expect(client.$disconnect).toHaveBeenCalledOnce();

    // After disconnect, getPrisma creates a new instance
    const newClient = getPrisma();
    expect(newClient).not.toBe(client);
  });

  it('does nothing if no client exists', async () => {
    stubValidEnv();

    const { disconnectPrisma } = await import('./client.js');
    // Should not throw
    await disconnectPrisma();
  });
});
