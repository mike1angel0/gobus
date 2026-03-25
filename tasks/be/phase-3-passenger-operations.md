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

**TASK-007: Create delay service** - Implemented DelayService with create (driver assignment/provider ownership validation, atomic deactivation of previous delays via $transaction), getBySchedule, update (provider ownership check). 18 unit tests.

**TASK-008: Create delay API routes** - Implemented 3 authenticated endpoints (GET list, POST create, PUT update) with Zod validation, role-based authorization, 24 integration tests.

---

## Driver Trip Management

**TASK-009: Create driver trip service** - Implemented DriverTripService with listTrips (daysOfWeek+tripDate filtering) and getTripDetail (driver assignment validation, passenger count, stop times). 19 unit tests.

### TASK-010: Create driver trip API routes
**Description:** Implement from spec: `GET /api/v1/driver/trips` (query: date, DRIVER role), `GET /api/v1/driver/trips/{scheduleId}` (DRIVER role, validates assignment).

**Acceptance Criteria:**
- [x] Both endpoints match OpenAPI spec
- [x] Requires DRIVER role
- [x] Assignment validation on detail endpoint
- [x] Integration tests
- [x] Typecheck passes

---

## Admin Operations

**TASK-011: Create admin service** - Implemented AdminService with listAllBuses (paginated, optional providerId filter) and toggleSeat (enable/disable). 11 unit tests.

**TASK-012: Create admin API routes** - Implemented GET /api/v1/admin/buses and PATCH /api/v1/admin/seats/:id with ADMIN role enforcement, Zod validation, 14 integration tests.

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
