import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SPEC_PATH = resolve(
  process.cwd(),
  '..',
  '..',
  'spec',
  'dist',
  'openapi.json',
);

interface SchemaMap {
  [key: string]: unknown;
}

interface OpenAPISpec {
  paths: Record<
    string,
    Record<
      string,
      {
        responses: Record<
          string,
          { content?: { 'application/json'?: { schema: unknown } } }
        >;
      }
    >
  >;
  components?: { schemas?: SchemaMap };
}

/** Recursively resolve internal $ref references against component schemas. */
function deref(
  node: unknown,
  schemas: SchemaMap,
  seen = new Set<string>(),
): unknown {
  if (node === null || node === undefined || typeof node !== 'object')
    return node;
  if (Array.isArray(node))
    return node.map((item) => deref(item, schemas, seen));

  const obj = node as Record<string, unknown>;
  if (typeof obj['$ref'] === 'string') {
    const ref = obj['$ref'] as string;
    const m = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (m?.[1] && schemas[m[1]] && !seen.has(m[1])) {
      seen.add(m[1]);
      return deref(schemas[m[1]], schemas, seen);
    }
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = deref(v, schemas, new Set(seen));
  }
  return result;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Create a validator that checks response bodies against OpenAPI spec schemas.
 *
 * Loads the bundled OpenAPI spec JSON, dereferences internal $ref pointers,
 * and compiles Ajv validators for each endpoint/method/status combination.
 */
export function createSpecValidator() {
  const spec: OpenAPISpec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
  const schemas = spec.components?.schemas ?? {};
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const cache = new Map<string, ReturnType<typeof ajv.compile>>();

  return {
    /**
     * Validate a response body against the OpenAPI spec schema.
     *
     * @param specPath - The OpenAPI path (e.g. '/api/v1/buses')
     * @param method - HTTP method (e.g. 'get', 'post')
     * @param statusCode - HTTP status code to validate against
     * @param body - The response body to validate
     */
    validate(
      specPath: string,
      method: string,
      statusCode: number,
      body: unknown,
    ): ValidationResult {
      const key = `${method.toLowerCase()}:${specPath}:${statusCode}`;
      if (!cache.has(key)) {
        const pathDef = spec.paths[specPath];
        if (!pathDef)
          return { valid: false, errors: [`Path not in spec: ${specPath}`] };
        const opDef = pathDef[method.toLowerCase()];
        if (!opDef)
          return {
            valid: false,
            errors: [`Method not in spec: ${method} ${specPath}`],
          };
        const resDef = opDef.responses[String(statusCode)];
        if (!resDef)
          return {
            valid: false,
            errors: [
              `Status ${statusCode} not in spec for ${method} ${specPath}`,
            ],
          };
        const schema = resDef.content?.['application/json']?.schema;
        if (!schema)
          return {
            valid: false,
            errors: [
              `No JSON schema for ${statusCode} ${method} ${specPath}`,
            ],
          };
        const resolved = deref(schema, schemas);
        cache.set(key, ajv.compile(resolved as Record<string, unknown>));
      }

      const validate = cache.get(key)!;
      if (validate(body)) return { valid: true, errors: [] };

      return {
        valid: false,
        errors: (validate.errors ?? []).map(
          (e) =>
            `${e.instancePath || '/'}: ${e.message} ${JSON.stringify(e.params)}`,
        ),
      };
    },

    /** Get all endpoint paths defined in the spec. */
    getSpecPaths(): string[] {
      return Object.keys(spec.paths);
    },
  };
}
