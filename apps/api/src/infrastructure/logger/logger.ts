import { getEnv } from '@/infrastructure/config/env.js';

/** Structured log entry shape. */
interface LogEntry {
  level: string;
  name: string;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

/** Simple structured logger for services. */
export interface Logger {
  /** Log informational business events. */
  info(msg: string, data?: Record<string, unknown>): void;
  /** Log technical debug details (suppressed in production). */
  debug(msg: string, data?: Record<string, unknown>): void;
  /** Log recoverable issues. */
  warn(msg: string, data?: Record<string, unknown>): void;
  /** Log failures and errors. */
  error(msg: string, data?: Record<string, unknown>): void;
}

/**
 * Create a structured JSON logger for a named service.
 * Debug logs are suppressed in production. All output goes to stdout/stderr as JSON.
 */
export function createLogger(name: string): Logger {
  const env = getEnv();
  const isProduction = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';

  function write(level: string, msg: string, data?: Record<string, unknown>): void {
    if (isTest) return;
    const entry: LogEntry = { level, name, msg, timestamp: new Date().toISOString(), ...data };
    const output = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  return {
    info: (msg, data) => write('info', msg, data),
    debug: (msg, data) => {
      if (!isProduction) write('debug', msg, data);
    },
    warn: (msg, data) => write('warn', msg, data),
    error: (msg, data) => write('error', msg, data),
  };
}
