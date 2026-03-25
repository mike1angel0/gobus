# Phase 2: Provider Domain — Routes, Buses, Schedules, Drivers

**Status**: Pending
**Dependencies**: Phase 1 (foundation, auth, Prisma schema)
**Goal**: Implement all provider-facing CRUD endpoints matching the OpenAPI spec. Full test coverage, ownership enforcement, input validation with Zod.

---

## Provider Profile

### TASK-001: Create provider service
**Description:** Create `src/application/services/provider.service.ts` with `ProviderService`. Methods: `getById(id)`, `getByUserId(userId)` — resolves provider from user's providerId, `updateProfile(providerId, data)`. Use `createLogger('provider-service')`.

**Acceptance Criteria:**
- [ ] All methods implemented
- [ ] `getByUserId` throws NOT_FOUND if user has no provider
- [ ] Unit tests with mocked Prisma
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

### TASK-002: Create provider routes
**Description:** Create `src/api/providers/routes.ts` and `schemas.ts`. Implement `GET /api/v1/providers/me` matching OpenAPI spec. Requires PROVIDER role.

**Acceptance Criteria:**
- [ ] Response matches spec schema exactly
- [ ] Requires PROVIDER role (403 otherwise)
- [ ] Integration test with Supertest
- [ ] Typecheck passes

---

## Route & Stop Management

### TASK-003: Create route domain types
**Description:** Create `src/domain/routes/route.entity.ts` with `RouteEntity`, `RouteWithStops`, `CreateRouteData`, `StopData` types matching OpenAPI schemas.

**Acceptance Criteria:**
- [ ] Types match OpenAPI schemas
- [ ] JSDoc on all types
- [ ] Typecheck passes

### TASK-004: Create route service
**Description:** Create `src/application/services/route.service.ts`. Methods: `listByProvider(providerId, pagination)` — paginated, `getById(id, providerId)` — with ownership check, `create(providerId, data)` — creates route + stops in transaction, `delete(id, providerId)` — with ownership check, cascades stops.

**Acceptance Criteria:**
- [ ] All CRUD operations implemented
- [ ] Ownership enforced: provider can only access own routes
- [ ] `create` uses Prisma transaction for route + stops
- [ ] `delete` verifies no active schedules reference the route
- [ ] Pagination with `buildPaginationMeta`
- [ ] Unit tests (happy path + ownership violation + not found)
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

### TASK-005: Create route API routes
**Description:** Implement all 4 route endpoints from OpenAPI spec: `GET /api/v1/routes` (list, paginated), `POST /api/v1/routes` (create with stops), `GET /api/v1/routes/{id}` (detail with stops), `DELETE /api/v1/routes/{id}`. All require PROVIDER role. Zod schemas match spec.

**Acceptance Criteria:**
- [ ] All 4 endpoints match OpenAPI spec
- [ ] List supports pagination (page, pageSize query params)
- [ ] Create validates stops array (min 2 stops, valid coordinates)
- [ ] Delete returns 204 No Content
- [ ] Integration tests for all endpoints + error cases
- [ ] Typecheck passes

---

## Bus & Seat Management

### TASK-006: Create bus domain types and templates
**Description:** Create `src/domain/buses/bus.entity.ts` with types matching OpenAPI schemas. Create `src/domain/buses/bus-templates.ts` with predefined bus templates (coach: Mercedes Tourismo 13x4, Setra S515 12x4, Neoplan 14x4; minibus: Mercedes Sprinter 8x3, Iveco Daily 7x3; microbus: Ford Transit 5x3, VW Crafter 4x3). Each template defines rows, columns, capacity, and seat configuration (types, labels, blocked seats, premium rows).

**Acceptance Criteria:**
- [ ] Bus entity types match OpenAPI schemas
- [ ] 7+ bus templates with realistic configurations
- [ ] Templates include seat type assignments (premium rows, accessible seats, blocked)
- [ ] JSDoc on all types and template constants
- [ ] Typecheck passes

### TASK-007: Create bus service
**Description:** Create `src/application/services/bus.service.ts`. Methods: `listByProvider(providerId, pagination)`, `getById(id, providerId)` — includes seats, `create(providerId, data)` — creates bus + seats in transaction, `update(id, providerId, data)` — rebuilds seat grid in transaction, `delete(id, providerId)` — with ownership check, `getTemplates()` — returns available templates.

**Acceptance Criteria:**
- [ ] All CRUD + templates method implemented
- [ ] Ownership enforced on all operations
- [ ] `create` generates seat grid from rows/columns with proper labels (1A, 1B, etc.)
- [ ] `create` supports template-based creation (applies seat types from template)
- [ ] `update` rebuilds seats in transaction (delete old + create new)
- [ ] `delete` checks no active schedules reference the bus
- [ ] Unit tests
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

### TASK-008: Create bus API routes
**Description:** Implement bus endpoints from OpenAPI spec: `GET /api/v1/buses` (list), `POST /api/v1/buses` (create), `GET /api/v1/buses/{id}` (detail with seats), `PUT /api/v1/buses/{id}` (update), `DELETE /api/v1/buses/{id}`, `GET /api/v1/buses/templates` (list templates). All require PROVIDER role.

**Acceptance Criteria:**
- [ ] All 6 endpoints match OpenAPI spec
- [ ] Create validates: rows 1-20, columns 1-6, licensePlate format
- [ ] Detail response includes full seat grid
- [ ] Integration tests for all endpoints
- [ ] Typecheck passes

---

## Driver Management

### TASK-009: Create driver service
**Description:** Create `src/application/services/driver.service.ts`. Methods: `listByProvider(providerId, pagination)` — includes assigned schedule count, `create(providerId, data)` — creates user with DRIVER role + links to provider, `delete(id, providerId)` — unassigns from schedules, soft or hard delete.

**Acceptance Criteria:**
- [ ] List includes assigned schedule count per driver
- [ ] Create hashes password, sets role=DRIVER, links providerId
- [ ] Create checks email uniqueness (409 CONFLICT)
- [ ] Delete unassigns driver from all schedules first
- [ ] Ownership enforced
- [ ] Unit tests
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

### TASK-010: Create driver API routes
**Description:** Implement from spec: `GET /api/v1/drivers` (list), `POST /api/v1/drivers` (create), `DELETE /api/v1/drivers/{id}`. Require PROVIDER role.

**Acceptance Criteria:**
- [ ] All 3 endpoints match OpenAPI spec
- [ ] Create validates required fields (name, email, password)
- [ ] Integration tests
- [ ] Typecheck passes

---

## Schedule Management

### TASK-011: Create schedule domain types
**Description:** Create `src/domain/schedules/schedule.entity.ts` with types: `ScheduleEntity`, `ScheduleWithDetails` (includes route, bus, driver, stopTimes, booking count), `CreateScheduleData`, `UpdateScheduleData`.

**Acceptance Criteria:**
- [ ] Types match OpenAPI schemas
- [ ] `ScheduleWithDetails` includes computed fields (availableSeats, bookingCount)
- [ ] JSDoc on all types
- [ ] Typecheck passes

### TASK-012: Create schedule service
**Description:** Create `src/application/services/schedule.service.ts`. Methods: `listByProvider(providerId, pagination, filters)` — filterable by routeId, busId, status, date range. `getById(id, providerId)` — with details. `create(providerId, data)` — validates route/bus belong to provider, auto-generates stopTimes from route stops. `update(id, providerId, data)` — assign/unassign driver, change status. `cancel(id, providerId)` — sets status=CANCELLED.

**Acceptance Criteria:**
- [ ] All methods implemented with ownership enforcement
- [ ] `create` validates route and bus belong to provider
- [ ] `create` auto-generates stopTimes from route's stops with interpolated times
- [ ] `update` validates driver belongs to same provider
- [ ] List supports filters: routeId, busId, status, date range
- [ ] Unit tests
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

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
