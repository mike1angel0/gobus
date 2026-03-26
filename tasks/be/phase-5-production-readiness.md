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

**TASK-015: Add integration tests for untested route files** — All 9 integration test files (buses, schedules, search, bookings, drivers, driver-trips, tracking, delays, admin) verified with 215+ tests. Fixed pre-existing test failures in spec-conformance, cache-control, and admin tests (missing $queryRaw mock, deletedAt field from soft-delete). All 968 tests pass, coverage 96.88%.

---

## Quality Gates

**TASK-016: Phase 5 final quality gates** — All 11 quality gates pass: typecheck (0 errors), lint (0 errors), format:check (clean), unit tests (503 pass), integration tests (465 pass), coverage (96.88% stmts, 92.39% branches, 97.32% funcs, 97.08% lines), build (succeeds), spec:lint (valid), api:validate (66 spec conformance tests pass), security:audit (no leaks, 0 vulnerabilities), no regressions from Phase 4. Fixed Prettier formatting in 17 files.

---

### Quality Assurance (Auto-Generated)

**Batch 1** — Generated 2026-03-26

**Overall Coverage**: 96.88% statements | 92.39% branches | 97.32% functions | 97.08% lines (target: 90% — PASS)
**Security Audit**: 0 vulnerabilities (PASS)
**Lint**: 0 errors, 0 warnings (PASS)
**Type Safety**: 0 `any` in production code (PASS)
**Architecture**: 0 domain layer violations (PASS)
**JSDoc**: All exported functions documented (PASS)
**API Contract**: All responses match envelope format; all errors RFC 9457 compliant (PASS)
**Zod `.strict()`**: All request body/query/param schemas use `.strict()` (PASS)

#### API Contract Stories

**US-QA-001** | Fix Zod schema: schedules `driverId` missing `minLength: 1` per OpenAPI spec
- AC1: `createScheduleRequestSchema.driverId` has `.min(1)` matching OpenAPI `minLength: 1`
- AC2: Integration test confirms empty string `""` for `driverId` returns 400

**US-QA-002** | Fix Zod schema: search `pageSize` max 50 vs OpenAPI spec max 100
- AC1: Either update Zod `searchQuerySchema.pageSize` to `.max(100)` matching spec, or add `maximum: 50` override in OpenAPI search query parameter
- AC2: Integration test confirms the chosen limit is enforced

**US-QA-003** | Fix Zod schema: provider/auth `createdAt`/`updatedAt` missing `.max(30)` per OpenAPI spec
- AC1: `providerSchema` and auth `userSchema` datetime fields have `.max(30)` matching OpenAPI `maxLength: 30`
- AC2: Pattern is consistent across all response schemas

#### Coverage Gap Stories

**US-QA-004** | ~~Add tests for tracking fleet list route~~ — DONE: Added 6 integration tests for GET /api/v1/tracking: PROVIDER happy path (with data and empty), 403 for PASSENGER, 403 for ADMIN, 403 for PROVIDER without providerId, 401 without auth.

**US-QA-005** | ~~Add tests for driver-trips passengers route~~ — DONE: Added 6 integration tests for GET /api/v1/driver/trips/:scheduleId/passengers: happy path with passengers, empty list, 403 for non-DRIVER, 404 for missing schedule, 404 for driver mismatch, 401 without auth.

**US-QA-006** | ~~Add tests for bus update with seat layout~~ — DONE: Added 2 unit tests for `updateBus` with seats: transaction branch (deleteMany + create with exact args), price default (0) and BLOCKED type disabling.

**US-QA-007** | ~~Add tests for driver-trip.service getPassengers~~ — DONE: Added 6 unit tests for `getPassengers`: happy path mapping 2 bookings to DriverTripPassenger with exact value assertions, query filter/ordering verification, empty array, 404 schedule not found, 404 driver mismatch, default date.

**US-QA-008** | Add tests for provider routes error branch (lines 45-47 uncovered)
- AC1: Integration test covers GET /api/v1/providers/me when user has no providerId (403)
- AC2: Integration test covers GET /api/v1/providers/analytics when user has no providerId (403)

#### Complexity Stories

**US-QA-009** | Refactor `authRoutes` in auth/routes.ts: extract individual route handlers (153 lines)
- AC1: `authRoutes` function is under 100 lines with handlers extracted to named functions
- AC2: All existing auth integration tests still pass

**US-QA-010** | Refactor `buildApp` in app.ts: extract plugin registration (115 lines)
- AC1: `buildApp` function is under 100 lines with plugin setup extracted
- AC2: All existing tests still pass

**US-QA-011** | Refactor `scheduleRoutes` in schedules/routes.ts: extract route handlers (113 lines)
- AC1: `scheduleRoutes` function is under 100 lines
- AC2: All existing schedule integration tests still pass

**US-QA-012** | Refactor `adminRoutes` in admin/routes.ts: extract route handlers (102 lines)
- AC1: `adminRoutes` function is under 100 lines
- AC2: All existing admin integration tests still pass
