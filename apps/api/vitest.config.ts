import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules', 'dist'],
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
        'src/domain/**/**.entity.ts',
        'src/shared/types.ts',
        'src/infrastructure/prisma/client.ts',
        'src/jobs/**',
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
