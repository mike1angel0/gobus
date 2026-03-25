import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Combined coverage config that runs both unit and integration tests.
 * Used by `npm run test:coverage` to get accurate coverage across all test types.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        'src/server.ts',
        'src/generated/**',
        'src/domain/**/index.ts',
        'src/domain/auth/auth.types.ts',
        'src/domain/users/user.entity.ts',
        'src/shared/types.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
      reporter: ['text', 'lcov', 'json-summary'],
    },
    unstubEnvs: true,
    setupFiles: ['src/test/setup.ts'],
  },
});
