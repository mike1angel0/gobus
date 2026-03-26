import { z } from 'zod';

/**
 * Schema for validating environment variables with Zod.
 * Throws a descriptive error on startup if any required variable is missing or invalid.
 */
const envSchema = z
  .object({
    /** PostgreSQL connection string */
    DATABASE_URL: z.string().min(1).describe('PostgreSQL connection string'),

    /** Secret key for signing JWT access tokens (min 32 chars for 256-bit security) */
    JWT_SECRET: z
      .string()
      .min(32)
      .describe('Secret key for signing JWT access tokens (>= 32 chars)'),

    /** Secret key for JWT refresh tokens (min 32 chars, must differ from JWT_SECRET) */
    JWT_REFRESH_SECRET: z
      .string()
      .min(32)
      .describe('Secret key for JWT refresh tokens (>= 32 chars, must differ from JWT_SECRET)'),

    /** Server port */
    PORT: z.coerce.number().int().min(1).max(65535).default(3000).describe('Server port'),

    /** Node environment */
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development')
      .describe('Node environment'),

    /** Allowed CORS origin */
    CORS_ORIGIN: z.string().default('http://localhost:3001').describe('Allowed CORS origin'),

    /** Log level for structured logging */
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info')
      .describe('Log level for structured logging'),

    /** Maximum number of connections in the PostgreSQL connection pool */
    DATABASE_POOL_MAX: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Maximum number of connections in the PostgreSQL connection pool'),
  })
  .refine((data) => data.JWT_SECRET !== data.JWT_REFRESH_SECRET, {
    message: 'JWT_SECRET and JWT_REFRESH_SECRET must be different values',
    path: ['JWT_REFRESH_SECRET'],
  });

/** Inferred type of validated environment variables. */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables from process.env.
 * Throws a formatted error listing all invalid/missing variables.
 */
export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return result.data;
}

let _env: Env | undefined;

/**
 * Return validated environment variables, parsing on first access.
 * Throws if required variables are missing or invalid.
 */
export function getEnv(): Env {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}
