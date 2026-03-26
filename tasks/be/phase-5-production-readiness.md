# Phase 5: Production Readiness — Process Safety, Performance, Spec Compliance, Infrastructure

**Status**: Pending
**Dependencies**: Phase 4 (hardening complete)
**Goal**: Fix all remaining backend issues blocking production deployment: server process safety, database performance, OpenAPI spec completeness, connection management, and infrastructure hardening.

---

## Completed Tasks

**TASK-001: Fix unhandled promise rejection in server startup** — Added `.catch()` on `start()`, extracted `shutdown()` with try/catch around `app.close()`+`disconnectPrisma()`, `void` signal handlers to properly handle async shutdown. 4 unit tests.

**TASK-002: Configure database connection pooling** — Added `max`, `min`, `idleTimeoutMillis` pool options to PrismaPg adapter. Pool max configurable via `DATABASE_POOL_MAX` env var (default: 10), idle timeout 30s. 5 unit tests.

**TASK-003: Fix search service in-memory pagination** — Replaced in-memory pagination with DB-level filtering using raw SQL self-join on StopTime (origin/destination ordering), separate count query without includes, and LIMIT/OFFSET pagination. Only fetches full data for the paginated subset. 10 unit tests, 2 new integration tests.

**TASK-004: Fix provider analytics sequential queries** — Wrapped all analytics queries in `$transaction` for consistent snapshot, parallelized 3 independent queries with `Promise.all`, reused active schedule data for route mapping instead of separate fetch, only fetches unmapped schedules when needed. 5 unit tests.

**TASK-005: Add missing database index** — Added `@@index([scheduleId])` to BusTracking model in schema.prisma. Migration created and applied.

---

## OpenAPI Spec Compliance

**TASK-006: Fix tripDate format inconsistency across schemas** — Standardized `tripDate` to `format: date` (YYYY-MM-DD) across all OpenAPI schemas, Zod schemas, and route serializers. Updated 8 spec files, 5 Zod schemas, 5 route serializers, and 7 integration tests.

**TASK-007: Document 500 error responses on all endpoints** — Added `InternalServerError` response component to `errors.yaml` referencing `ErrorResponse` schema. Added `'500': $ref` to all 50 operations across 12 path files. Bundled spec.

**TASK-008: Document rate limiting in OpenAPI spec** — Added `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` headers to `TooManyRequests` response component. Added `'429': $ref` to all 50 operations across 12 path files.

**TASK-009: Add missing validation constraints to OpenAPI spec** — Added `minLength: 1` to all required string fields in request schemas (auth emails, schedule IDs, driver email). Added `minLength: 1` to IdParam and inline path/query ID parameters. Documented 409 on POST /schedules for overlap/bus unavailability. Updated POST /routes 400 description to mention invalid stop ordering.

---

## Infrastructure Hardening

**TASK-010: Remove hardcoded secrets from docker-compose.yml** — Replaced hardcoded POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET with `${VAR?error}` syntax requiring explicit env vars. DATABASE_URL now references POSTGRES_PASSWORD variable. Created root `.env.example` documenting all required and optional docker-compose variables.

**TASK-011: Add response compression** — Installed `@fastify/compress` and registered in `app.ts` with 1KB threshold, Brotli preferred, gzip fallback. Disabled in test environment. 2 unit tests.

**TASK-012: Add cache headers to remaining endpoints** — All GET endpoints already had `privateNoCache`/`cachePublic`/`noCache`. Added `noCache` preHandler to all 25 mutation endpoints (POST/PUT/PATCH/DELETE) across auth, bookings, buses, routes, drivers, schedules, delays, admin, tracking. 3 integration tests.

**TASK-013: Clean up unused JWT_REFRESH_SECRET** — Removed unused JWT_REFRESH_SECRET env var (refresh tokens use SHA-256 hashes, not signed JWTs). Updated env.ts schema, .env.example (root + api), docker-compose.yml, test setup, and CLAUDE.md.

---

## Data Integrity

**TASK-014: Implement user soft-delete** — Added `deletedAt DateTime?` to User model with migration. Auth plugin and login reject soft-deleted users (401). Admin DELETE /api/v1/admin/users/:id endpoint sets deletedAt and revokes sessions. All user queries (admin listUsers, driver listing, schedule driver validation) exclude soft-deleted users. OpenAPI spec and Zod schemas updated. 10 new unit tests (softDeleteUser, soft-delete rejection in auth/admin).

---

## Missing Integration Tests

### TASK-015: Add integration tests for untested route files
**Description:** 9 of 13 route files lack integration tests: drivers, driver-trips, bookings, admin, schedules, search, tracking, delays, buses. Only auth, health, providers, and spec-conformance have integration tests.

**Acceptance Criteria:**
- [ ] `buses.integration.test.ts` — CRUD operations, ownership verification, seat layout validation
- [ ] `schedules.integration.test.ts` — CRUD, status transitions, stop time ordering
- [ ] `search.integration.test.ts` — search with filters, trip details, pagination
- [ ] `bookings.integration.test.ts` — create, cancel, double-booking prevention, seat validation
- [ ] `drivers.integration.test.ts` — CRUD, provider-scoped access
- [ ] `driver-trips.integration.test.ts` — list by date, start/end trip
- [ ] `tracking.integration.test.ts` — position updates, bus tracking queries
- [ ] `delays.integration.test.ts` — create delay, list by schedule
- [ ] `admin.integration.test.ts` — user management, audit logs, fleet management
- [ ] All tests pass
- [ ] Coverage ≥ 85%

---

## Quality Gates

### TASK-016: Phase 5 final quality gates
**Description:** Run all quality gates and fix every issue introduced by Phase 5.

**Acceptance Criteria:**
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — passes
- [ ] `npm run test` — all tests pass
- [ ] `npm run test:integration` — all integration tests pass
- [ ] `npm run test:coverage` — ≥ 85% (statements, branches, functions, lines)
- [ ] `npm run build` — succeeds
- [ ] `npm run spec:lint` — OpenAPI spec validates
- [ ] `npm run api:validate` — all responses match spec schemas
- [ ] `npm run security:audit` — clean
- [ ] No regressions from Phase 4
