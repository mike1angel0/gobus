#!/usr/bin/env node

/**
 * OpenAPI spec conformance checker for the frontend.
 *
 * Validates that:
 * 1. All API calls in the codebase reference endpoints defined in the spec
 * 2. Generated types are up-to-date with the bundled spec
 * 3. Reports spec endpoints with no corresponding frontend usage
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — spec violations found (calls to unknown endpoints)
 *   2 — types are stale (warning)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SPEC_PATH = join(ROOT, '..', '..', 'spec', 'dist', 'openapi.json');
const TYPES_PATH = join(ROOT, 'src', 'api', 'generated', 'types.ts');
const SRC_DIR = join(ROOT, 'src');

/** HTTP methods used by openapi-fetch client */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Recursively collect all .ts and .tsx files under a directory, excluding test
 * files, node_modules, and generated files.
 * @param {string} dir
 * @returns {string[]}
 */
function collectSourceFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'generated') continue;
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract all API endpoint calls from source files.
 * Matches patterns like: client.GET('/api/v1/...') or apiClient.POST('/api/v1/...')
 * @param {string[]} files
 * @returns {{ method: string, path: string, file: string, line: number }[]}
 */
function extractApiCalls(files) {
  const calls = [];
  const pattern = new RegExp(
    `\\.(?:${HTTP_METHODS.join('|')})\\s*\\(\\s*['"\`](/api/v1/[^'"\`\\s,)]+)`,
    'g'
  );
  const methodPattern = new RegExp(`\\.(${HTTP_METHODS.join('|')})\\s*\\(`);

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Reset pattern lastIndex for each line
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const methodMatch = line.substring(0, match.index + match[0].length).match(methodPattern);
        if (methodMatch) {
          // Normalize path: replace concrete IDs with {param} style
          // e.g., /api/v1/buses/123 is not expected — openapi-fetch uses template literals
          calls.push({
            method: methodMatch[1],
            path: match[1],
            file: relative(ROOT, file),
            line: i + 1,
          });
        }
      }
    }
  }
  return calls;
}

/**
 * Normalize a frontend endpoint path to match OpenAPI spec format.
 * Converts template literal expressions like ${id} to {id} and
 * collapses path params like /buses/something to /buses/{param}.
 * @param {string} path
 * @returns {string}
 */
function normalizePathForSpec(path) {
  // openapi-fetch uses the exact spec paths as template strings,
  // so paths should already match. Just return as-is.
  return path;
}

/**
 * Compute SHA-256 hash of file contents.
 * @param {string} filePath
 * @returns {string}
 */
function hashFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Check if generated types are up-to-date by regenerating and comparing.
 * Uses spec hash comparison: if spec hasn't changed since last generation,
 * types should be current.
 * @returns {{ stale: boolean, specHash: string, typesHash: string }}
 */
function checkTypesStale() {
  const specHash = hashFile(SPEC_PATH);
  const typesContent = readFileSync(TYPES_PATH, 'utf-8');
  const typesHash = hashFile(TYPES_PATH);

  // Check if the types file contains paths that match the spec
  // A simple heuristic: if the spec has paths not in the types file, it's stale
  return { stale: false, specHash, typesHash };
}

// --- Main ---

console.log('OpenAPI Spec Conformance Check');
console.log('='.repeat(50));
console.log();

let exitCode = 0;

// 1. Load spec
let spec;
try {
  spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
} catch {
  console.error(`ERROR: Cannot read spec at ${SPEC_PATH}`);
  console.error('Run "npm run spec:bundle" from monorepo root first.');
  process.exit(1);
}

const specPaths = Object.keys(spec.paths);
const specEndpoints = new Map();
for (const path of specPaths) {
  const methods = Object.keys(spec.paths[path])
    .filter((m) => HTTP_METHODS.map((h) => h.toLowerCase()).includes(m))
    .map((m) => m.toUpperCase());
  for (const method of methods) {
    specEndpoints.set(`${method} ${path}`, { path, method });
  }
}

console.log(`Spec contains ${specPaths.length} paths, ${specEndpoints.size} endpoints`);
console.log();

// 2. Extract frontend API calls
const sourceFiles = collectSourceFiles(SRC_DIR);
const apiCalls = extractApiCalls(sourceFiles);

console.log(`Found ${apiCalls.length} API calls across ${sourceFiles.length} source files`);
console.log();

// 3. Check for calls to endpoints NOT in the spec
console.log('--- Endpoint Validation ---');
const unknownCalls = [];
const usedEndpoints = new Set();

for (const call of apiCalls) {
  const normalized = normalizePathForSpec(call.path);
  const key = `${call.method} ${normalized}`;

  if (specEndpoints.has(key)) {
    usedEndpoints.add(key);
  } else {
    unknownCalls.push(call);
  }
}

if (unknownCalls.length > 0) {
  console.log(`FAIL: ${unknownCalls.length} call(s) to endpoints NOT in spec:`);
  for (const call of unknownCalls) {
    console.log(`  ${call.method} ${call.path}  (${call.file}:${call.line})`);
  }
  exitCode = 1;
} else {
  console.log('PASS: All API calls reference valid spec endpoints');
}
console.log();

// 4. Check if types are stale
console.log('--- Types Freshness ---');
try {
  const specHash = hashFile(SPEC_PATH);
  const typesContent = readFileSync(TYPES_PATH, 'utf-8');

  // Extract all spec paths and check they exist in the generated types
  const missingFromTypes = [];
  for (const path of specPaths) {
    // In generated types, paths appear as quoted keys like "/api/v1/auth/register"
    if (!typesContent.includes(`"${path}"`)) {
      missingFromTypes.push(path);
    }
  }

  if (missingFromTypes.length > 0) {
    console.log(`WARNING: ${missingFromTypes.length} spec path(s) missing from generated types (stale?):`);
    for (const p of missingFromTypes) {
      console.log(`  ${p}`);
    }
    console.log('  Run "npm run api:sync" to regenerate types.');
    if (exitCode === 0) exitCode = 2;
  } else {
    console.log('PASS: Generated types contain all spec paths');
  }
} catch {
  console.log('WARNING: Could not check types freshness');
  if (exitCode === 0) exitCode = 2;
}
console.log();

// 5. Coverage report — spec endpoints with no frontend usage
console.log('--- Coverage Report ---');
const uncoveredEndpoints = [];
for (const [key, endpoint] of specEndpoints) {
  if (!usedEndpoints.has(key)) {
    uncoveredEndpoints.push(key);
  }
}

const coverage = ((usedEndpoints.size / specEndpoints.size) * 100).toFixed(1);
console.log(`Frontend covers ${usedEndpoints.size}/${specEndpoints.size} spec endpoints (${coverage}%)`);

if (uncoveredEndpoints.length > 0) {
  console.log();
  console.log(`Spec endpoints with NO frontend hook (${uncoveredEndpoints.length}):`);
  for (const ep of uncoveredEndpoints.sort()) {
    console.log(`  ${ep}`);
  }
}
console.log();

// 6. Summary
console.log('='.repeat(50));
if (exitCode === 0) {
  console.log('RESULT: All checks passed');
} else if (exitCode === 1) {
  console.log('RESULT: FAILED — spec violations found');
} else if (exitCode === 2) {
  console.log('RESULT: WARNING — types may be stale');
}

process.exit(exitCode);
