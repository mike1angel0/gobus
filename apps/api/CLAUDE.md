# @transio/api — Fastify Backend

## Tech Stack

- **Runtime**: Node.js + TypeScript 5 (strict mode)
- **Framework**: Fastify 5
- **ORM**: Prisma 7 with `@prisma/adapter-pg` driver adapter
- **Validation**: Zod (manual `.parse()`, no Fastify type provider)
- **Auth**: JWT (access 15min + refresh 7d), bcryptjs, SHA-256 hashed tokens
- **Testing**: Vitest + Supertest, v8 coverage (85% threshold)
- **Linting**: ESLint 10 flat config + Prettier
- **Docs**: @fastify/swagger + @fastify/swagger-ui at `/docs`

## Quick Start

```bash
# From monorepo root
npm install

# From apps/api/
cp .env.example .env          # Edit with your PostgreSQL credentials
npm run db:generate            # Generate Prisma client
npm run db:push                # Push schema to database
npm run db:seed                # Seed demo data
npm run dev                    # Start dev server (tsx watch)
```

## Architecture

Layered architecture with strict dependency rules:

```
api/  →  application/  →  domain/  ←  infrastructure/
```

| Layer | Path | Responsibility | May depend on |
|-------|------|----------------|---------------|
| **API** | `src/api/` | Routes, plugins, Zod schemas | application, domain, shared |
| **Application** | `src/application/` | Services, business logic | domain, infrastructure, shared |
| **Domain** | `src/domain/` | Entities, types, errors | shared only |
| **Infrastructure** | `src/infrastructure/` | Prisma, logger, env config | domain, shared |
| **Shared** | `src/shared/` | Types, schemas, pagination | nothing |

**Rules**: Domain NEVER imports from api/ or application/. Shared NEVER imports from any other layer.

## API-First Workflow

The OpenAPI spec at `spec/openapi.yaml` (monorepo root) is the **single source of truth**.

1. **Read the spec** for the endpoint you're implementing
2. **Create Zod schemas** in `src/api/{domain}/schemas.ts` matching spec exactly (field names, types, constraints, `.describe()`)
3. **Implement route** in `src/api/{domain}/routes.ts` using manual Zod `.parse()`
4. **Implement service** in `src/application/services/{domain}.service.ts`
5. **Validate** request/response shapes match the spec field-by-field

## API Conventions

### Response Envelope

```typescript
// Single item
{ data: T }

// List with pagination
{ data: T[], meta: { page, pageSize, total, totalPages } }
```

Use `dataResponse()` / `paginatedResponse()` wrappers from `src/shared/schemas.ts`.

### Error Format (RFC 9457 Problem Details)

```json
{
  "type": "https://transio.ro/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request body validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

Error codes defined in `src/domain/errors/error-codes.ts`. Throw `AppError` from services.

### Naming

- **JSON fields**: camelCase
- **URLs**: kebab-case
- **Files**: kebab-case (e.g., `auth.service.ts`, `role-guard.ts`)

## Route Implementation Pattern

```typescript
// src/api/{domain}/routes.ts
import { FastifyInstance } from 'fastify';
import { SomeRequestSchema, SomeResponseSchema } from './schemas.js';

export async function someRoutes(app: FastifyInstance): Promise<void> {
  app.post('/path', {
    schema: { tags: ['Domain'], description: '...' },
    preHandler: [app.authenticate],  // if auth required
  }, async (request, reply) => {
    const body = SomeRequestSchema.parse(request.body);
    const result = await someService.doThing(body);
    return reply.status(200).send({ data: SomeResponseSchema.parse(result) });
  });
}
```

## Service Pattern

```typescript
// src/application/services/{domain}.service.ts
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { createLogger } from '@/infrastructure/logger/logger.js';
import { AppError } from '@/domain/errors/index.js';

const logger = createLogger('domain-service');

export class DomainService {
  /** Brief description of what this does. */
  async doThing(data: InputType): Promise<OutputType> {
    const prisma = getPrisma();
    // ... business logic
    // Throw AppError for business rule violations
  }
}
```

## Quality Gates

```bash
npm run typecheck          # tsc --noEmit (zero errors)
npm run lint               # ESLint (zero errors, watch complexity warnings)
npm run format:check       # Prettier (consistent formatting)
npm run test               # Vitest unit tests
npm run test:integration   # Vitest integration tests (Supertest)
npm run test:coverage      # Coverage ≥ 85% (statements, branches, functions, lines)
npm run build              # tsc + tsc-alias (must succeed)
```

**ESLint limits** (warnings trigger refactoring):
- `max-lines`: 500 per file
- `max-lines-per-function`: 250
- `complexity`: 15
- `max-depth`: 4

## Test Conventions

| Layer | Test Type | File Pattern | Notes |
|-------|-----------|--------------|-------|
| domain/ | Unit | `*.test.ts` | Pure logic, no mocks |
| shared/ | Unit | `*.test.ts` | Validation, utilities |
| application/ | Unit | `*.test.ts` | Mock Prisma with `vi.mock()` |
| api/ | Integration | `*.integration.test.ts` | Real Fastify app + Supertest |

**Assertion style**: Assert exact values (`toBe()`, `toEqual()`, `toThrow()`), not existence (`toBeDefined()`, `toBeTruthy()`).

**Auth in tests**: Use `createAuthHeader()` and `createTestUser()` from `src/test/helpers.ts`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `JWT_SECRET` | Access token signing secret (≥16 chars) | — (required) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (≥16 chars) | — (required) |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | `development` / `production` / `test` | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3001` |

## Key Patterns

- **Lazy singletons**: `getEnv()` and `getPrisma()` — avoids module-level side effects that break tests
- **Zod `.strict()`**: All request schemas use strict mode to reject unknown fields
- **Zod `.describe()`**: Every field has a description matching the OpenAPI spec
- **Zod `.max()` / `.min()`**: All strings have maxLength, all numbers have min/max, matching spec constraints
- **Token security**: Refresh and reset tokens stored as SHA-256 hashes, never plaintext
- **Account lockout**: 5 failed logins → 15min lock
- **Ownership enforcement**: Mutation endpoints verify `resource.providerId === user.providerId` (return 404, not 403)
