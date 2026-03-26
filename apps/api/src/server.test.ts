import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the server shutdown sequence.
 *
 * Since server.ts has side effects (calls start() at import time), we
 * reset modules between tests and dynamically import the module each time.
 */

const mockClose = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockDisconnect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockListen = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockLogInfo = vi.fn();
const mockLogError = vi.fn();

const mockApp = {
  close: mockClose,
  listen: mockListen,
  log: { info: mockLogInfo, error: mockLogError },
};

vi.mock('./app.js', () => ({
  buildApp: vi.fn().mockResolvedValue(mockApp),
}));

vi.mock('./infrastructure/prisma/client.js', () => ({
  disconnectPrisma: mockDisconnect,
}));

describe('server shutdown', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let addedListeners: { signal: string; fn: (...args: unknown[]) => void }[] = [];
  let originalProcessOn: typeof process.on;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-register mocks after resetModules
    vi.doMock('./app.js', () => ({
      buildApp: vi.fn().mockResolvedValue(mockApp),
    }));
    vi.doMock('./infrastructure/prisma/client.js', () => ({
      disconnectPrisma: mockDisconnect,
    }));

    addedListeners = [];
    originalProcessOn = process.on.bind(process);

    // Intercept signal registrations
    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, listener: (...args: unknown[]) => void) => {
      if (event === 'SIGINT' || event === 'SIGTERM') {
        addedListeners.push({ signal: event as string, fn: listener });
        return process;
      }
      return originalProcessOn(event as string, listener);
    });

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    vi.mocked(process.on).mockRestore();
  });

  it('registers SIGINT and SIGTERM handlers after start', async () => {
    await import('./server.js');

    await vi.waitFor(() => {
      expect(mockListen).toHaveBeenCalledOnce();
    });

    const signals = addedListeners.map((l) => l.signal);
    expect(signals).toContain('SIGINT');
    expect(signals).toContain('SIGTERM');
  });

  it('shutdown calls app.close then disconnectPrisma then exits with 0', async () => {
    await import('./server.js');

    await vi.waitFor(() => {
      expect(mockListen).toHaveBeenCalledOnce();
    });

    const sigtermHandler = addedListeners.find((l) => l.signal === 'SIGTERM');
    expect(sigtermHandler).toBeDefined();
    sigtermHandler!.fn();

    await vi.waitFor(() => {
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    expect(mockClose).toHaveBeenCalledOnce();
    expect(mockDisconnect).toHaveBeenCalledOnce();

    // Verify order: close before disconnect
    const closeOrder = mockClose.mock.invocationCallOrder[0];
    const disconnectOrder = mockDisconnect.mock.invocationCallOrder[0];
    expect(closeOrder).toBeLessThan(disconnectOrder);
  });

  it('shutdown logs error if app.close throws but still exits', async () => {
    mockClose.mockRejectedValueOnce(new Error('close failed'));

    await import('./server.js');

    await vi.waitFor(() => {
      expect(mockListen).toHaveBeenCalledOnce();
    });

    const sigintHandler = addedListeners.find((l) => l.signal === 'SIGINT');
    expect(sigintHandler).toBeDefined();
    sigintHandler!.fn();

    await vi.waitFor(() => {
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    expect(mockLogError).toHaveBeenCalled();
  });

  it('start() catch handler exits with 1 if buildApp throws', async () => {
    const buildError = new Error('buildApp failed');
    vi.doMock('./app.js', () => ({
      buildApp: vi.fn().mockRejectedValue(buildError),
    }));

    // Spy on console.error for the .catch() handler
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('./server.js');

    await vi.waitFor(() => {
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Fatal: failed to start server', buildError);
    consoleErrorSpy.mockRestore();
  });
});
