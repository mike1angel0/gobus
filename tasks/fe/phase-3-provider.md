# Phase 3: Provider Features — Dashboard, Routes, Fleet, Schedules, Drivers, Tracking

**Status**: Pending
**Dependencies**: FE Phase 2 (passenger features), BE Phase 2 & 3 (provider + operations endpoints)
**Goal**: Implement the full provider management UI: dashboard analytics, route CRUD, fleet management with seat map editor, schedule management, driver management, and real-time fleet tracking.

---

## React Query Hooks

### TASK-001: Create provider domain hooks
**Description:** Create hooks for all provider API calls:
- `src/hooks/use-routes.ts`: `useRoutes(pagination)`, `useCreateRoute()`, `useDeleteRoute()`
- `src/hooks/use-buses.ts`: `useBuses(pagination)`, `useBusDetail(id)`, `useCreateBus()`, `useUpdateBus()`, `useDeleteBus()`, `useBusTemplates()`
- `src/hooks/use-drivers.ts`: `useDrivers(pagination)`, `useCreateDriver()`, `useDeleteDriver()`
- `src/hooks/use-schedules.ts`: `useSchedules(pagination, filters)`, `useScheduleDetail(id)`, `useCreateSchedule()`, `useUpdateSchedule()`, `useCancelSchedule()`
- `src/hooks/use-tracking.ts`: `useTracking(busId)` with polling (5s), `useUpdateTracking()`, `useProviderTracking()`
- `src/hooks/use-delays.ts`: `useDelays(scheduleId, tripDate)`, `useCreateDelay()`, `useUpdateDelay()`

All use typed API client, proper cache invalidation, toast notifications on mutations.

**Acceptance Criteria:**
- [x] All hooks use OpenAPI-generated types
- [x] Mutations invalidate relevant queries
- [x] Tracking hook uses polling (refetchInterval: 5000)
- [x] Error handling with toast notifications
- [x] Unit tests for mutation cache invalidation logic
- [x] JSDoc on all hooks
- [x] Typecheck passes

---

## Provider Dashboard

### TASK-002: Create provider dashboard page
**Description:** Create `src/pages/provider/dashboard.tsx`. Displays: summary stats cards (total bookings, total revenue, active trips today, average occupancy %). Revenue by route chart (bar chart). Upcoming schedules list (next 5). Quick actions (create route, create schedule). Stats computed from schedules + bookings data.

**Acceptance Criteria:**
- [x] Summary stat cards with icons
- [x] Revenue chart (use recharts or simple bar chart)
- [x] Upcoming schedules list
- [x] Quick action buttons
- [x] Loading skeletons for all sections
- [x] Responsive grid layout
- [x] Component test
- [x] Typecheck passes

---

## Route Management

### TASK-003: Create route management page
**Description:** Create `src/pages/provider/routes.tsx`. List view with route cards showing: route name, stop count, schedule count. Create route dialog/form: name input, stops builder (add stops from city list, reorder with drag or arrows, set coordinates). Delete with confirmation (warn if schedules exist).

**Acceptance Criteria:**
- [x] Route list with cards
- [x] Create dialog with form (name + stops builder)
- [x] Stops builder: add from city dropdown, reorder, remove
- [x] Each stop shows name + coordinates
- [x] Minimum 2 stops validation
- [x] Delete with confirmation dialog
- [x] Mutations update list immediately (optimistic or invalidation)
- [x] Loading/empty/error states
- [x] Component test for CRUD flow
- [x] Typecheck passes

---

## Completed Tasks

- **TASK-004**: Fleet management page — bus list, create dialog (template + manual), edit with seat map editor, delete with confirmation
- **TASK-005**: Seat map editor component — click to cycle types, brush toolbar for direct type selection, visual distinction, seat count summary, keyboard accessible

---

## Schedule Management

### TASK-006: Create schedule management page
**Description:** Create `src/pages/provider/schedules.tsx`. List with filter bar (by route, bus, status, date range). Schedule cards showing: route name, bus info, departure/arrival times, driver assignment, days of week, booking count. Create form: select route, bus, driver (optional), departure/arrival times, days of week multi-select or specific date, base price. Edit: assign/unassign driver, change status. Cancel with confirmation.

**Acceptance Criteria:**
- [x] Schedule list with filter bar
- [x] Filters: route dropdown, bus dropdown, status toggle, date range
- [x] Schedule cards with all info
- [x] Create form with proper validation
- [x] Route/bus/driver dropdowns populated from provider's data
- [x] Days of week selector (multi-toggle: Mon-Sun)
- [x] Driver assignment/unassignment
- [x] Cancel schedule with confirmation
- [x] Component test
- [x] Typecheck passes

---

## Completed Tasks

- **TASK-007**: Driver management page — driver list with cards (name, email, phone, assigned schedules), create dialog with validation, 409 email conflict handling, delete with schedule impact warning, 28 component tests

---

## Live Tracking

### TASK-008: Create provider tracking page
**Description:** Create `src/pages/provider/tracking.tsx`. Full-width live map showing all provider's active buses. Bus list sidebar with: bus info, current route, current stop, speed, last updated. Click bus in list to center map on it. Delay reporting form: select schedule, enter delay minutes, reason dropdown, notes. Active delays list with deactivate button.

**Acceptance Criteria:**
- [ ] Full-width LiveMap showing all active provider buses
- [ ] Bus list sidebar with real-time info (5s polling)
- [ ] Click bus → map centers on it
- [ ] Delay reporting form with validation
- [ ] Active delays list with deactivate button
- [ ] Responsive: map fullscreen on mobile, sidebar as bottom sheet
- [ ] Component test
- [ ] Typecheck passes

---

## Quality Gates

### TASK-009: Run Phase 3 quality gates
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
