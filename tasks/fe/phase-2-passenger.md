# Phase 2: Passenger Features — Search, Trip Details, Bookings

**Status**: Complete
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

### ~~TASK-010: Create my-trips page~~ ✅

---

## Quality Assurance — Batch 1

### QA Analysis Summary

| Category | Status | Details |
|----------|--------|---------|
| Type Safety | ✅ Clean | No `any` types in Phase 2 production code |
| Accessibility | ⚠️ 1 issue | Duplicate ID in TripCard |
| Coverage | ⚠️ 3 files | Branch coverage below 90% in 3 files |
| JSDoc | ✅ Clean | All exported items documented |
| Complexity | ✅ Clean | No files >500 lines, no functions >250 lines |
| Lint | ✅ Clean | 0 errors, 0 warnings in Phase 2 files |

**Overall coverage: 95.86% statements, 90.53% branch, 97.44% functions, 96.97% lines**

---

### US-QA-001: Fix a11y — TripCard duplicate element ID

**Priority**: High | **Category**: Accessibility

The `id="trip-stops"` on the expandable stops list (line 179) is hardcoded. When multiple TripCards render on the search results page, duplicate IDs break the `aria-controls` association and violate HTML spec.

**Acceptance Criteria**:
1. Each TripCard generates a unique ID for its stops list (e.g., `trip-stops-${scheduleId}`) and its `aria-controls` attribute matches
2. Tests verify unique IDs across multiple rendered TripCards

---

### US-QA-002: Improve branch coverage for booking-card.tsx

**Priority**: Medium | **Category**: Coverage

Branch coverage is 82.14%. Uncovered branch: `CANCELLED` status styling path (line 59).

**Acceptance Criteria**:
1. Add test case rendering BookingCard with `status: 'CANCELLED'` and assert the red styling class is applied
2. Branch coverage reaches ≥90%

---

### US-QA-003: Improve branch coverage for trip detail page

**Priority**: Medium | **Category**: Coverage

Branch coverage is 81.13%. Uncovered branch: `formatDuration` returning combined hours+minutes format (line 46).

**Acceptance Criteria**:
1. Add test for `formatDuration` with a trip where duration has both hours and minutes (e.g., 2h 30m)
2. Branch coverage reaches ≥90%

---

### US-QA-004: Improve branch coverage for use-bookings hooks

**Priority**: Medium | **Category**: Coverage

Branch coverage is 84.61%. Uncovered branches: nullish coalescing in error handlers (lines 140, 183) — `error.detail ?? error.title` fallback paths.

**Acceptance Criteria**:
1. Add tests for `useCreateBooking` and `useCancelBooking` error handlers where API error has `detail: null` (falls back to `title`)
2. Branch coverage reaches ≥90%

---

## Completed Tasks

### ~~TASK-011: Run Phase 2 quality gates~~ ✅
