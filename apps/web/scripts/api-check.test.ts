/**
 * Tests for the api-check conformance script.
 *
 * Runs the script as a subprocess and validates output and exit codes.
 */

import { execFile } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, 'api-check.js');
const WEB_ROOT = join(__dirname, '..');
const TYPES_PATH = join(WEB_ROOT, 'src', 'api', 'generated', 'types.ts');

/**
 * Run the api-check script and return stdout, stderr, and exit code.
 */
function runScript(): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile(
      'node',
      [SCRIPT],
      { cwd: WEB_ROOT },
      (error: Error | null, stdout: string, stderr: string) => {
        resolve({
          stdout,
          stderr,
          code: error ? (error as Error & { code: number }).code : 0,
        });
      },
    );
  });
}

describe('api-check script', () => {
  it('exits with code 0 when spec and codebase are in sync', async () => {
    const result = await runScript();
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('All API calls reference valid spec endpoints');
    expect(result.stdout).toContain('Generated types contain all spec paths');
    expect(result.stdout).toContain('All checks passed');
  });

  it('reports spec endpoint count', async () => {
    const result = await runScript();
    expect(result.stdout).toMatch(/Spec contains \d+ paths, \d+ endpoints/);
  });

  it('reports frontend API call count', async () => {
    const result = await runScript();
    expect(result.stdout).toMatch(/Found \d+ API calls across \d+ source files/);
  });

  it('reports coverage percentage', async () => {
    const result = await runScript();
    expect(result.stdout).toMatch(/Frontend covers \d+\/\d+ spec endpoints/);
  });

  it('lists uncovered spec endpoints', async () => {
    const result = await runScript();
    expect(result.stdout).toContain('Spec endpoints with NO frontend hook');
    expect(result.stdout).toContain('GET /api/v1/admin/users');
  });

  describe('stale types detection', () => {
    let originalTypes: string;

    beforeAll(() => {
      originalTypes = readFileSync(TYPES_PATH, 'utf-8');
    });

    afterAll(() => {
      writeFileSync(TYPES_PATH, originalTypes);
    });

    it('warns when generated types are missing spec paths', async () => {
      const modified = originalTypes.replace(
        '"/api/v1/admin/buses"',
        '"/api/v1/admin/buses-REMOVED"',
      );
      writeFileSync(TYPES_PATH, modified);

      const result = await runScript();
      expect(result.stdout).toContain('WARNING');
      expect(result.stdout).toContain('missing from generated types');
      expect(result.stdout).toContain('/api/v1/admin/buses');
      expect(result.code).toBe(2);

      writeFileSync(TYPES_PATH, originalTypes);
    });
  });
});
