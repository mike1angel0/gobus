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
    include: ['src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        'src/server.ts',
      ],
      reporter: ['text', 'lcov', 'json-summary'],
    },
    setupFiles: ['src/test/setup.ts'],
  },
});
