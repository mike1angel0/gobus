# Phase 5: Production Readiness — Process Safety, Performance, Spec Compliance, Infrastructure

**Status**: Pending
**Dependencies**: Phase 4 (hardening complete)
**Goal**: Fix all remaining backend issues blocking production deployment: server process safety, database performance, OpenAPI spec completeness, connection management, and infrastructure hardening.

---

## Completed Tasks

**TASK-001: Fix unhandled promise rejection in server startup** — Added `.catch()` on `start()`, extracted `shutdown()` with try/catch around `app.close()`+`disconnectPrisma()`, `void` signal handlers to properly handle async shutdown. 4 unit tests.

**TASK-002: Configure database connection pooling** — Added `max`, `min`, `idleTimeoutMillis` pool options to PrismaPg adapter. Pool max configurable via `DATABASE_POOL_MAX` env var (default: 10), idle timeout 30s. 5 unit tests.

**TASK-003: Fix search service in-memory pagination** — Replaced in-memory pagination with DB-level filtering using raw SQL self-join on StopTime (origin/destination ordering), separate count query without includes, and LIMIT/OFFSET pagination. Only fetches full data for the paginated subset. 10 unit tests, 2 new integration tests.

---

## Database & Performance

### TASK-004: Fix provider analytics sequential queries
**Description:** `src/application/services/provider.service.ts` lines 90-187 makes 4-5 sequential database queries without a transaction, risking inconsistent snapshots. Also has N+1 on schedule→route mapping at line 160.

**Acceptance Criteria:**
- [ ] Analytics queries wrapped in a read-only transaction for consistent snapshot
- [ ] Schedule→route mapping prefetched in single query with `include` (no separate fetch)
- [ ] Sequential queries consolidated where possible (e.g., `Promise.all` for independent queries)
- [ ] Unit test for analytics with mock data
- [ ] Typecheck passes

### TASK-005: Add missing database index
**Description:** `BusTracking.scheduleId` has no index in `prisma/schema.prisma` despite frequent queries by schedule in tracking routes.

**Acceptance Criteria:**
- [ ] `@@index([scheduleId])` added to `BusTracking` model in schema.prisma
- [ ] Migration created with `prisma migrate dev`
- [ ] Typecheck passes

---

## OpenAPI Spec Compliance

### TASK-006: Fix tripDate format inconsistency across schemas
**Description:** `tripDate` field uses `format: date` in SearchResult (`spec/components/schemas/search.yaml` L47) but `format: date-time` in Schedule (`schedule.yaml` L124), Booking (`booking.yaml` L57), and DriverTrip (`admin.yaml` L204). The implementation in search routes slices to date format. Standardize across all schemas.

**Acceptance Criteria:**
- [ ] `tripDate` uses consistent format across ALL schemas (date-time or date — pick one)
- [ ] If `date`: all serialization uses `.toISOString().slice(0, 10)`
- [ ] If `date-time`: all serialization uses full `.toISOString()`
- [ ] All Zod schemas match the chosen format
- [ ] `npm run spec:lint` passes
- [ ] `npm run api:validate` passes (spec conformance test)
- [ ] Typecheck passes

### TASK-007: Document 500 error responses on all endpoints
**Description:** None of the 43 endpoints in the OpenAPI spec document `500 Internal Server Error`. In production, any endpoint can fail with 5xx. Add a reusable 500 response component and reference it from all endpoints.

**Acceptance Criteria:**
- [ ] `spec/components/responses/errors.yaml` has `InternalServerError` response referencing `ErrorResponse` schema
- [ ] All 43 endpoint operations include `'500': $ref: '../responses/errors.yaml#/InternalServerError'`
- [ ] `npm run spec:lint` passes
- [ ] Typecheck passes

### TASK-008: Document rate limiting in OpenAPI spec
**Description:** Rate limiting is implemented but not documented in the spec. Missing: `429 Too Many Requests` response, `X-RateLimit-*` response headers, `Retry-After` header.

**Acceptance Criteria:**
- [ ] `spec/components/responses/errors.yaml` has `RateLimited` response (429) with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` headers
- [ ] All endpoints reference `'429': $ref` to the rate limited response
- [ ] `npm run spec:lint` passes
- [ ] Typecheck passes

### TASK-009: Add missing validation constraints to OpenAPI spec
**Description:** Several schema fields lack `minLength` constraints. ID parameters lack `pattern` for CUID format validation. Some 4xx error codes are missing from specific endpoints (POST /schedules missing 409 for overlap, POST /routes missing 400 for invalid stop order).

**Acceptance Criteria:**
- [ ] All required string fields have `minLength: 1`
- [ ] ID parameters have `pattern` for CUID format (or at least `minLength: 1, maxLength: 30`)
- [ ] `POST /schedules` documents `409` for schedule overlap/bus unavailability
- [ ] `POST /routes` documents `400` for invalid stop ordering
- [ ] `npm run spec:lint` passes
- [ ] Typecheck passes

---

## Infrastructure Hardening

### TASK-010: Remove hardcoded secrets from docker-compose.yml
**Description:** `docker-compose.yml` lines 6-8 and 31-33 have hardcoded fallback values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `POSTGRES_PASSWORD`. If deployed without overriding env vars, all JWTs are forgeable.

**Acceptance Criteria:**
- [ ] JWT_SECRET and JWT_REFRESH_SECRET have NO default fallback in docker-compose.yml (require explicit env var)
- [ ] POSTGRES_PASSWORD has NO default fallback
- [ ] Docker compose fails with clear error message if secrets not provided
- [ ] `.env.example` at repo root documents all required docker-compose variables
- [ ] Existing `apps/api/.env.example` updated if needed

### TASK-011: Add response compression
**Description:** No `@fastify/compress` plugin registered. JSON API responses are sent uncompressed, wasting bandwidth.

**Acceptance Criteria:**
- [ ] `@fastify/compress` installed and registered in `app.ts`
- [ ] Gzip compression enabled for responses > 1KB
- [ ] Brotli preferred when client supports it
- [ ] Disabled in test environment (like other middleware)
- [ ] Typecheck passes

### TASK-012: Add cache headers to remaining endpoints
**Description:** Cache-Control headers are only set on search and tracking endpoints. All other authenticated CRUD endpoints (providers, buses, routes, schedules, drivers, bookings, delays, admin) lack cache directives.

**Acceptance Criteria:**
- [ ] All authenticated GET endpoints: `private, no-cache` via `privateNoCache()` preHandler
- [ ] All mutation endpoints (POST/PUT/PATCH/DELETE): `no-store` via `noCache()` preHandler
- [ ] Verified with integration test or curl
- [ ] Typecheck passes

### TASK-013: Clean up unused JWT_REFRESH_SECRET
**Description:** `JWT_REFRESH_SECRET` is required in env validation (`src/infrastructure/config/env.ts` line 19-22) but never used — refresh tokens are stored as SHA-256 hashes, not signed JWTs. Either use it or remove it.

**Acceptance Criteria:**
- [ ] Decision: either implement refresh tokens as JWTs signed with this secret, OR remove the env var requirement
- [ ] If removed: update env.ts schema, .env.example, docker-compose.yml, test setup
- [ ] If used: implement JWT-based refresh tokens with this secret
- [ ] All tests pass
- [ ] Typecheck passes

---

## Data Integrity

### TASK-014: Implement user soft-delete or cascade strategy
**Description:** `ON DELETE RESTRICT` on Booking→User and Message→User prevents user account deletion. No soft-delete pattern exists. Users who want to delete their accounts cannot.

**Acceptance Criteria:**
- [ ] Decision: soft-delete (add `deletedAt` column) OR archive-and-cascade
- [ ] If soft-delete: add `deletedAt DateTime?` to User model, update all queries to exclude soft-deleted users, add admin endpoint to soft-delete users
- [ ] If archive: create archive table, move user data before cascade delete
- [ ] Migration created
- [ ] Auth plugin rejects soft-deleted/archived users
- [ ] Unit tests for deletion flow
- [ ] Typecheck passes

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
