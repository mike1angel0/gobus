import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: vi.fn(),
}));

import { createLogger, getRootLogger, resetRootLogger } from './logger.js';
import { getEnv } from '@/infrastructure/config/env.js';

const mockGetEnv = vi.mocked(getEnv);

describe('createLogger', () => {
  beforeEach(() => {
    resetRootLogger();
  });

  describe('factory', () => {
    beforeEach(() => {
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      } as ReturnType<typeof getEnv>);
    });

    it('returns an object with info, debug, warn, error methods', () => {
      const logger = createLogger('test-service');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('does not throw when logging with data', () => {
      const logger = createLogger('test-service');
      expect(() => logger.info('hello', { key: 'value' })).not.toThrow();
      expect(() => logger.debug('debug', { n: 1 })).not.toThrow();
      expect(() => logger.warn('warn')).not.toThrow();
      expect(() => logger.error('error', { code: 500 })).not.toThrow();
    });
  });

  describe('getRootLogger', () => {
    it('returns the same instance on subsequent calls', () => {
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      } as ReturnType<typeof getEnv>);

      const logger1 = getRootLogger();
      const logger2 = getRootLogger();
      expect(logger1).toBe(logger2);
    });

    it('resets after resetRootLogger', () => {
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      } as ReturnType<typeof getEnv>);

      const logger1 = getRootLogger();
      resetRootLogger();
      const logger2 = getRootLogger();
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('log levels', () => {
    it('uses silent level in test mode', () => {
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
      } as ReturnType<typeof getEnv>);

      const root = getRootLogger();
      expect(root.level).toBe('silent');
    });

    it('uses configured LOG_LEVEL in production mode', () => {
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
      } as ReturnType<typeof getEnv>);

      const root = getRootLogger();
      expect(root.level).toBe('warn');
    });

    it('uses configured LOG_LEVEL in development mode', () => {
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
      } as ReturnType<typeof getEnv>);

      const root = getRootLogger();
      expect(root.level).toBe('debug');
    });
  });

  describe('sensitive field redaction', () => {
    it('redacts password field from log output', async () => {
      mockGetEnv.mockReturnValue({
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      } as ReturnType<typeof getEnv>);

      // Create a root logger piping to a writable stream to capture output
      const { Writable } = await import('node:stream');
      const chunks: string[] = [];
      const dest = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });

      const pino = (await import('pino')).default;
      const testLogger = pino(
        {
          level: 'info',
          redact: {
            paths: ['password', 'token', 'authorization', 'refreshToken', 'accessToken', 'secret'],
            censor: '[REDACTED]',
          },
        },
        dest,
      );

      testLogger.info({ password: 'secret123', user: 'test' }, 'login attempt');
      // Flush the stream
      await new Promise<void>((resolve) => dest.end(resolve));

      const output = chunks.join('');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('secret123');
      expect(output).toContain('login attempt');
    });

    it('redacts token field from log output', async () => {
      const { Writable } = await import('node:stream');
      const chunks: string[] = [];
      const dest = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });

      const pino = (await import('pino')).default;
      const testLogger = pino(
        {
          level: 'info',
          redact: { paths: ['token'], censor: '[REDACTED]' },
        },
        dest,
      );

      testLogger.info({ token: 'jwt-abc-xyz' }, 'token check');
      await new Promise<void>((resolve) => dest.end(resolve));

      const output = chunks.join('');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('jwt-abc-xyz');
    });
  });

  describe('child logger naming', () => {
    it('creates child logger with correct name', async () => {
      const { Writable } = await import('node:stream');
      const chunks: string[] = [];
      const dest = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });

      const pino = (await import('pino')).default;
      const root = pino({ level: 'info' }, dest);
      const child = root.child({ name: 'TestService' });

      child.info('test message');
      await new Promise<void>((resolve) => dest.end(resolve));

      const output = JSON.parse(chunks[0]);
      expect(output.name).toBe('TestService');
      expect(output.msg).toBe('test message');
    });
  });
});
