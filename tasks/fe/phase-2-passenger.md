# Phase 2: Passenger Features — Search, Trip Details, Bookings

**Status**: Pending
**Dependencies**: FE Phase 1 (scaffold, API client, auth, shell), BE Phase 3 (search, booking, tracking endpoints)
**Goal**: Implement all passenger-facing features: trip search, trip detail with interactive seat selection, booking creation, and booking management. All API calls use the typed client generated from the OpenAPI spec.

---

## React Query Hooks

### ~~TASK-001: Create search hooks~~ ✅

### ~~TASK-002: Create booking hooks~~ ✅

---

## Search & Results

### ~~TASK-003: Create SearchForm component~~ ✅

### ~~TASK-004: Create TripCard component~~ ✅

### ~~TASK-005: Create search results page~~ ✅

---

## Trip Detail & Seat Selection

### ~~TASK-006: Create SeatMap component~~ ✅

### ~~TASK-007: Create DelayBadge component~~ ✅

### ~~TASK-008: Create trip detail page~~ ✅

---

## Live Map

### ~~TASK-009: Create LiveMap component~~ ✅

---

## Booking Management

### TASK-010: Create my-trips page
**Description:** Create `src/pages/my-trips.tsx`. Uses `useBookings` hook (paginated). Tab split: Upcoming (CONFIRMED, future tripDate) and Past (COMPLETED or past tripDate). Each booking shows: route name, date, times, seats, price, status badge, delay info. Expandable detail: stop list, live tracking map (if active). Cancel button on upcoming bookings (with confirmation dialog).

**Acceptance Criteria:**
- [ ] Upcoming/Past tab split
- [ ] Booking cards with all info
- [ ] Expandable detail section
- [ ] Live map for active trips with tracking
- [ ] Cancel button with confirmation dialog
- [ ] Cancel calls API and invalidates queries
- [ ] Pagination (load more or page numbers)
- [ ] Loading skeleton, empty state ("No trips yet"), error state
- [ ] Component test
- [ ] Typecheck passes

---

## Quality Gates

### TASK-011: Run Phase 2 quality gates
**Description:** Run and fix all checks.

**Acceptance Criteria:**
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — passes
- [ ] `npm run test` — all pass
- [ ] `npm run test:coverage` ≥ 90%
- [ ] `npm run build` — succeeds
- [ ] Zero `any` in src/ (excluding test/)
- [ ] JSDoc on all exported functions/components/hooks
- [ ] All components accessible (WCAG 2.1 AA)
- [ ] All API calls use typed client (no raw fetch)
