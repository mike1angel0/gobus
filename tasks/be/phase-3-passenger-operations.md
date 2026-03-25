# Phase 3: Passenger & Operations — Search, Bookings, Tracking, Delays

**Status**: Pending
**Dependencies**: Phase 2 (provider domain)
**Goal**: Implement passenger-facing search and booking, driver trip management, real-time GPS tracking, and delay reporting. All endpoints match the OpenAPI spec. Race conditions prevented with database transactions and constraints.

---

## Search & Trip Details

### TASK-001: Create search service
**Description:** Create `src/application/services/search.service.ts`. Methods: `searchTrips(query: { origin, destination, date? })` — finds schedules matching origin/destination stops, computes segment pricing (destStop.priceFromStart - originStop.priceFromStart), returns available seat count per schedule, includes active delays. `getTripDetails(scheduleId, tripDate)` — returns full schedule with seat availability map (which seats are booked for that tripDate).

**Acceptance Criteria:**
- [x] `searchTrips` matches routes containing both origin and destination stops (in correct order)
- [x] Segment pricing calculated correctly
- [x] Available seats = total enabled seats - booked seats for tripDate
- [x] Active delays included in results
- [x] `getTripDetails` returns per-seat availability status
- [x] Date filtering works (specific date or upcoming)
- [x] Unit tests for pricing calculation logic
- [x] Unit tests for seat availability logic
- [x] JSDoc on all public methods
- [x] Typecheck passes

### TASK-002: Create search API routes
**Description:** Implement from spec: `GET /api/v1/search` (public, query params: origin, destination, date), `GET /api/v1/trips/{scheduleId}` (public, query param: date). Both public (no auth required).

**Acceptance Criteria:**
- [x] Search returns array matching OpenAPI `SearchResult` schema
- [x] Trip detail returns full schedule + seat map matching spec
- [x] No auth required (public endpoints)
- [x] Integration tests: search with results, search with no results, trip detail with bookings
- [x] Typecheck passes

---

## Booking System

### TASK-003: Create booking service
**Description:** Create `src/application/services/booking.service.ts`. Methods: `listByUser(userId, pagination)` — user's bookings with schedule details. `getById(id, userId)` — with ownership enforcement. `create(userId, data)` — **MUST use Prisma `$transaction` with isolation level** to prevent race conditions: check seat availability, create booking + booking seats atomically. `cancel(id, userId)` — with ownership enforcement, sets status=CANCELLED.

**Acceptance Criteria:**
- [x] `create` uses `prisma.$transaction` with serializable isolation
- [x] Double-booking prevented by transaction + unique constraint on BookingSeat(scheduleId, seatLabel, tripDate)
- [x] `create` validates: seats exist on bus, seats are enabled, seats not BLOCKED type
- [x] `create` validates: boardingStop and alightingStop exist in schedule's stops, boarding comes before alighting
- [x] `create` calculates totalPrice from segment pricing
- [x] Generates unique orderId (cuid) for each booking
- [x] `cancel` enforces ownership (user can only cancel own bookings)
- [x] `cancel` only works on CONFIRMED bookings
- [x] Unit tests for validation logic
- [x] Unit tests for price calculation
- [x] JSDoc on all public methods
- [x] Typecheck passes

**TASK-004: Create booking API routes** - Implemented 4 authenticated endpoints (GET list, POST create, GET detail, DELETE cancel) with Zod validation, ownership enforcement, 19 integration tests.

---

## Completed Tasks

**TASK-005: Create tracking service** - Implemented TrackingService with updatePosition (driver assignment validation, upsert), getByBusId, getActiveByProvider. 11 unit tests.

**TASK-006: Create tracking API routes** - Implemented GET /api/v1/tracking/:busId and POST /api/v1/tracking with DRIVER role enforcement, Zod validation, 13 integration tests.

---

## Delay Management

### TASK-007: Create delay service
**Description:** Create `src/application/services/delay.service.ts`. Methods: `getBySchedule(scheduleId, tripDate)` — returns active delay(s). `create(userId, data)` — validates user is driver assigned to schedule OR provider owning schedule, deactivates previous active delays for same schedule+tripDate, creates new active delay. `update(id, providerId, data)` — provider can activate/deactivate delays.

**Acceptance Criteria:**
- [ ] `create` validates authorization (driver assignment or provider ownership)
- [ ] `create` deactivates previous delays atomically (transaction)
- [ ] Only one active delay per schedule+tripDate at any time
- [ ] `update` restricted to PROVIDER role
- [ ] Unit tests
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

### TASK-008: Create delay API routes
**Description:** Implement from spec: `GET /api/v1/delays` (query: scheduleId, tripDate, authenticated), `POST /api/v1/delays` (DRIVER or PROVIDER), `PUT /api/v1/delays/{id}` (PROVIDER only).

**Acceptance Criteria:**
- [ ] All 3 endpoints match OpenAPI spec
- [ ] GET filters by scheduleId + tripDate
- [ ] POST validates role-based authorization
- [ ] PUT restricted to PROVIDER role
- [ ] Integration tests
- [ ] Typecheck passes

---

## Driver Trip Management

### TASK-009: Create driver trip service
**Description:** Create `src/application/services/driver-trip.service.ts`. Methods: `listTrips(driverId, date)` — returns schedules assigned to driver for the given date (matching daysOfWeek or specific tripDate). `getTripDetail(driverId, scheduleId)` — returns full schedule with route, stops, bookings, current tracking, active delay. Validates driver assignment.

**Acceptance Criteria:**
- [ ] `listTrips` filters by date (matches daysOfWeek pattern or specific tripDate)
- [ ] `getTripDetail` validates driver is assigned to this schedule
- [ ] Detail includes booking count, passenger list, tracking status, active delay
- [ ] Unit tests
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

### TASK-010: Create driver trip API routes
**Description:** Implement from spec: `GET /api/v1/driver/trips` (query: date, DRIVER role), `GET /api/v1/driver/trips/{scheduleId}` (DRIVER role, validates assignment).

**Acceptance Criteria:**
- [ ] Both endpoints match OpenAPI spec
- [ ] Requires DRIVER role
- [ ] Assignment validation on detail endpoint
- [ ] Integration tests
- [ ] Typecheck passes

---

## Admin Operations

### TASK-011: Create admin service
**Description:** Create `src/application/services/admin.service.ts`. Methods: `listAllBuses(pagination)` — returns all buses across all providers with seat details. `toggleSeat(seatId, enabled: boolean)` — enables/disables seat.

**Acceptance Criteria:**
- [ ] `listAllBuses` returns all buses with provider info and seats
- [ ] `toggleSeat` updates isEnabled flag
- [ ] Unit tests
- [ ] JSDoc
- [ ] Typecheck passes

### TASK-012: Create admin API routes
**Description:** Implement from spec: `GET /api/v1/admin/buses` (ADMIN role, paginated), `PATCH /api/v1/admin/seats/{id}` (ADMIN role).

**Acceptance Criteria:**
- [ ] Both endpoints match OpenAPI spec
- [ ] Requires ADMIN role (403 otherwise)
- [ ] Integration tests
- [ ] Typecheck passes

---

## Quality Gates

### TASK-013: Run Phase 3 quality gates
**Description:** Run all checks, fix issues.

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
- [ ] `npm run spec:lint` — spec validates
