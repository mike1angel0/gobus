import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: vi.fn(),
}));

import { createLogger } from './logger.js';
import { getEnv } from '@/infrastructure/config/env.js';

const mockGetEnv = vi.mocked(getEnv);

describe('createLogger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('in development mode', () => {
    beforeEach(() => {
      mockGetEnv.mockReturnValue({ NODE_ENV: 'development' } as ReturnType<typeof getEnv>);
    });

    it('writes info log to stdout as JSON', () => {
      const logger = createLogger('test-service');
      logger.info('hello world', { key: 'value' });

      expect(stdoutSpy).toHaveBeenCalledOnce();
      const output = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(output.level).toBe('info');
      expect(output.name).toBe('test-service');
      expect(output.msg).toBe('hello world');
      expect(output.key).toBe('value');
      expect(typeof output.timestamp).toBe('string');
    });

    it('writes debug log to stdout', () => {
      const logger = createLogger('debug-svc');
      logger.debug('debug msg');

      expect(stdoutSpy).toHaveBeenCalledOnce();
      const output = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(output.level).toBe('debug');
      expect(output.msg).toBe('debug msg');
    });

    it('writes warn log to stdout', () => {
      const logger = createLogger('warn-svc');
      logger.warn('warning');

      expect(stdoutSpy).toHaveBeenCalledOnce();
      const output = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(output.level).toBe('warn');
    });

    it('writes error log to stderr', () => {
      const logger = createLogger('err-svc');
      logger.error('failure', { code: 500 });

      expect(stderrSpy).toHaveBeenCalledOnce();
      expect(stdoutSpy).not.toHaveBeenCalled();
      const output = JSON.parse((stderrSpy.mock.calls[0][0] as string).trim());
      expect(output.level).toBe('error');
      expect(output.msg).toBe('failure');
      expect(output.code).toBe(500);
    });
  });

  describe('in production mode', () => {
    beforeEach(() => {
      mockGetEnv.mockReturnValue({ NODE_ENV: 'production' } as ReturnType<typeof getEnv>);
    });

    it('suppresses debug logs', () => {
      const logger = createLogger('prod-svc');
      logger.debug('should not appear');

      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('still writes info logs', () => {
      const logger = createLogger('prod-svc');
      logger.info('visible');

      expect(stdoutSpy).toHaveBeenCalledOnce();
    });
  });

  describe('in test mode', () => {
    beforeEach(() => {
      mockGetEnv.mockReturnValue({ NODE_ENV: 'test' } as ReturnType<typeof getEnv>);
    });

    it('suppresses all logs', () => {
      const logger = createLogger('test-svc');
      logger.info('silent');
      logger.debug('silent');
      logger.warn('silent');
      logger.error('silent');

      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });
});
