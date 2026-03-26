import pino from 'pino';
import { getEnv } from '@/infrastructure/config/env.js';

/** Structured logger interface for services and plugins. */
export interface Logger {
  /** Log informational business events. */
  info(msg: string, data?: Record<string, unknown>): void;
  /** Log technical debug details. */
  debug(msg: string, data?: Record<string, unknown>): void;
  /** Log recoverable issues. */
  warn(msg: string, data?: Record<string, unknown>): void;
  /** Log failures and errors. */
  error(msg: string, data?: Record<string, unknown>): void;
}

/** Sensitive field paths to redact from all log output. */
const REDACT_PATHS = [
  'password',
  'token',
  'authorization',
  'refreshToken',
  'accessToken',
  'secret',
  'req.headers.authorization',
  'req.headers.cookie',
];

let _rootLogger: pino.Logger | undefined;

/**
 * Return the Pino logger configuration object.
 * Used by Fastify which requires a config object, not a Pino instance.
 */
export function getLoggerConfig(): pino.LoggerOptions & { transport?: pino.TransportSingleOptions } {
  const env = getEnv();
  const isTest = env.NODE_ENV === 'test';
  const isDev = env.NODE_ENV === 'development';

  return {
    level: isTest ? 'silent' : env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    ...(isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

/**
 * Return the shared root Pino logger instance, creating it on first access.
 * Configures JSON output in production, pretty-print in development, and silent in test.
 */
export function getRootLogger(): pino.Logger {
  if (_rootLogger) return _rootLogger;
  _rootLogger = pino(getLoggerConfig());
  return _rootLogger;
}

/**
 * Create a named child logger for a service or plugin.
 * Inherits configuration (level, redaction, transport) from the shared root logger.
 * @param name - Identifier for the service or module (appears in log output as `name` field).
 */
export function createLogger(name: string): Logger {
  const child = getRootLogger().child({ name });

  return {
    info: (msg, data) => child.info(data ?? {}, msg),
    debug: (msg, data) => child.debug(data ?? {}, msg),
    warn: (msg, data) => child.warn(data ?? {}, msg),
    error: (msg, data) => child.error(data ?? {}, msg),
  };
}

/**
 * Reset the root logger instance. Used only in tests to ensure a clean state.
 */
export function resetRootLogger(): void {
  _rootLogger = undefined;
}
