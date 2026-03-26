/**
 * Global test setup for Vitest.
 *
 * Configure environment variables and global hooks for all tests.
 */

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/transio_test';
process.env.LOG_LEVEL = 'silent';
