# Phase 2: Provider Domain — Routes, Buses, Schedules, Drivers

**Status**: Pending
**Dependencies**: Phase 1 (foundation, auth, Prisma schema)
**Goal**: Implement all provider-facing CRUD endpoints matching the OpenAPI spec. Full test coverage, ownership enforcement, input validation with Zod.

---

## Provider Profile

### TASK-001: Create provider service
**Description:** Create `src/application/services/provider.service.ts` with `ProviderService`. Methods: `getById(id)`, `getByUserId(userId)` — resolves provider from user's providerId, `updateProfile(providerId, data)`. Use `createLogger('provider-service')`.

**Acceptance Criteria:**
- [x] All methods implemented
- [x] `getByUserId` throws NOT_FOUND if user has no provider
- [x] Unit tests with mocked Prisma
- [x] JSDoc on all public methods
- [x] Typecheck passes

### TASK-002: Create provider routes
**Description:** Create `src/api/providers/routes.ts` and `schemas.ts`. Implement `GET /api/v1/providers/me` matching OpenAPI spec. Requires PROVIDER role.

**Acceptance Criteria:**
- [x] Response matches spec schema exactly
- [x] Requires PROVIDER role (403 otherwise)
- [x] Integration test with Supertest
- [x] Typecheck passes

---

## Route & Stop Management

### TASK-003: Create route domain types
**Description:** Create `src/domain/routes/route.entity.ts` with `RouteEntity`, `RouteWithStops`, `CreateRouteData`, `StopData` types matching OpenAPI schemas.

**Acceptance Criteria:**
- [x] Types match OpenAPI schemas
- [x] JSDoc on all types
- [x] Typecheck passes

### TASK-004: Create route service
**Description:** Create `src/application/services/route.service.ts`. Methods: `listByProvider(providerId, pagination)` — paginated, `getById(id, providerId)` — with ownership check, `create(providerId, data)` — creates route + stops in transaction, `delete(id, providerId)` — with ownership check, cascades stops.

**Acceptance Criteria:**
- [x] All CRUD operations implemented
- [x] Ownership enforced: provider can only access own routes
- [x] `create` uses Prisma transaction for route + stops
- [x] `delete` verifies no active schedules reference the route
- [x] Pagination with `buildPaginationMeta`
- [x] Unit tests (happy path + ownership violation + not found)
- [x] JSDoc on all public methods
- [x] Typecheck passes

### TASK-005: Create route API routes
**Description:** Implement all 4 route endpoints from OpenAPI spec: `GET /api/v1/routes` (list, paginated), `POST /api/v1/routes` (create with stops), `GET /api/v1/routes/{id}` (detail with stops), `DELETE /api/v1/routes/{id}`. All require PROVIDER role. Zod schemas match spec.

**Acceptance Criteria:**
- [x] All 4 endpoints match OpenAPI spec
- [x] List supports pagination (page, pageSize query params)
- [x] Create validates stops array (min 2 stops, valid coordinates)
- [x] Delete returns 204 No Content
- [x] Integration tests for all endpoints + error cases
- [x] Typecheck passes

---

## Bus & Seat Management

### TASK-006: Create bus domain types and templates
**Description:** Create `src/domain/buses/bus.entity.ts` with types matching OpenAPI schemas. Create `src/domain/buses/bus-templates.ts` with predefined bus templates (coach: Mercedes Tourismo 13x4, Setra S515 12x4, Neoplan 14x4; minibus: Mercedes Sprinter 8x3, Iveco Daily 7x3; microbus: Ford Transit 5x3, VW Crafter 4x3). Each template defines rows, columns, capacity, and seat configuration (types, labels, blocked seats, premium rows).

**Acceptance Criteria:**
- [x] Bus entity types match OpenAPI schemas
- [x] 7+ bus templates with realistic configurations
- [x] Templates include seat type assignments (premium rows, accessible seats, blocked)
- [x] JSDoc on all types and template constants
- [x] Typecheck passes

### TASK-007: Create bus service
**Description:** Create `src/application/services/bus.service.ts`. Methods: `listByProvider(providerId, pagination)`, `getById(id, providerId)` — includes seats, `create(providerId, data)` — creates bus + seats in transaction, `update(id, providerId, data)` — rebuilds seat grid in transaction, `delete(id, providerId)` — with ownership check, `getTemplates()` — returns available templates.

**Acceptance Criteria:**
- [x] All CRUD + templates method implemented
- [x] Ownership enforced on all operations
- [x] `create` generates seat grid from rows/columns with proper labels (1A, 1B, etc.)
- [x] `create` supports template-based creation (applies seat types from template)
- [x] `update` rebuilds seats in transaction (delete old + create new)
- [x] `delete` checks no active schedules reference the bus
- [x] Unit tests
- [x] JSDoc on all public methods
- [x] Typecheck passes

### TASK-008: Create bus API routes
**Description:** Implement bus endpoints from OpenAPI spec: `GET /api/v1/buses` (list), `POST /api/v1/buses` (create), `GET /api/v1/buses/{id}` (detail with seats), `PUT /api/v1/buses/{id}` (update), `DELETE /api/v1/buses/{id}`, `GET /api/v1/buses/templates` (list templates). All require PROVIDER role.

**Acceptance Criteria:**
- [x] All 6 endpoints match OpenAPI spec
- [x] Create validates: rows 1-20, columns 1-6, licensePlate format
- [x] Detail response includes full seat grid
- [x] Integration tests for all endpoints
- [x] Typecheck passes

---

## Driver Management

### TASK-009: Create driver service
**Description:** Create `src/application/services/driver.service.ts`. Methods: `listByProvider(providerId, pagination)` — includes assigned schedule count, `create(providerId, data)` — creates user with DRIVER role + links to provider, `delete(id, providerId)` — unassigns from schedules, soft or hard delete.

**Acceptance Criteria:**
- [x] List includes assigned schedule count per driver
- [x] Create hashes password, sets role=DRIVER, links providerId
- [x] Create checks email uniqueness (409 CONFLICT)
- [x] Delete unassigns driver from all schedules first
- [x] Ownership enforced
- [x] Unit tests
- [x] JSDoc on all public methods
- [x] Typecheck passes

### TASK-010: Create driver API routes
**Description:** Implement from spec: `GET /api/v1/drivers` (list), `POST /api/v1/drivers` (create), `DELETE /api/v1/drivers/{id}`. Require PROVIDER role.

**Acceptance Criteria:**
- [x] All 3 endpoints match OpenAPI spec
- [x] Create validates required fields (name, email, password)
- [x] Integration tests
- [x] Typecheck passes

---

## Schedule Management

### TASK-011: Create schedule domain types
**Description:** Create `src/domain/schedules/schedule.entity.ts` with types: `ScheduleEntity`, `ScheduleWithDetails` (includes route, bus, driver, stopTimes, booking count), `CreateScheduleData`, `UpdateScheduleData`.

**Acceptance Criteria:**
- [x] Types match OpenAPI schemas
- [x] `ScheduleWithDetails` includes computed fields (availableSeats, bookingCount)
- [x] JSDoc on all types
- [x] Typecheck passes

### TASK-012: Create schedule service
**Description:** Create `src/application/services/schedule.service.ts`. Methods: `listByProvider(providerId, pagination, filters)` — filterable by routeId, busId, status, date range. `getById(id, providerId)` — with details. `create(providerId, data)` — validates route/bus belong to provider, auto-generates stopTimes from route stops. `update(id, providerId, data)` — assign/unassign driver, change status. `cancel(id, providerId)` — sets status=CANCELLED.

**Acceptance Criteria:**
- [x] All methods implemented with ownership enforcement
- [x] `create` validates route and bus belong to provider
- [x] `create` auto-generates stopTimes from route's stops with interpolated times
- [x] `update` validates driver belongs to same provider
- [x] List supports filters: routeId, busId, status, date range
- [x] Unit tests
- [x] JSDoc on all public methods
- [x] Typecheck passes

### TASK-013: Create schedule API routes
**Description:** Implement from spec: `GET /api/v1/schedules` (list, paginated, filterable), `POST /api/v1/schedules` (create), `GET /api/v1/schedules/{id}` (detail), `PUT /api/v1/schedules/{id}` (update), `DELETE /api/v1/schedules/{id}` (cancel). Require PROVIDER role.

**Acceptance Criteria:**
- [ ] All 5 endpoints match OpenAPI spec
- [ ] List supports query filters (routeId, busId, status, dateFrom, dateTo)
- [ ] Create validates all references exist and belong to provider
- [ ] Cancel returns 204
- [ ] Integration tests for all endpoints
- [ ] Typecheck passes

---

## Quality Gates

### TASK-014: Run Phase 2 quality gates
**Description:** Run all quality checks. Fix any issues.

**Acceptance Criteria:**
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — passes
- [ ] `npm run test` — all pass
- [ ] `npm run test:coverage` ≥ 85%
- [ ] `npm run build` — succeeds
- [ ] Zero `any` in src/ (excluding test/)
- [ ] JSDoc on all exported functions/classes/methods
- [ ] All responses match OpenAPI spec schemas
