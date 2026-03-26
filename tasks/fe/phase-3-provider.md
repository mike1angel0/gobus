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
- [ ] Route list with cards
- [ ] Create dialog with form (name + stops builder)
- [ ] Stops builder: add from city dropdown, reorder, remove
- [ ] Each stop shows name + coordinates
- [ ] Minimum 2 stops validation
- [ ] Delete with confirmation dialog
- [ ] Mutations update list immediately (optimistic or invalidation)
- [ ] Loading/empty/error states
- [ ] Component test for CRUD flow
- [ ] Typecheck passes

---

## Fleet Management

### TASK-004: Create fleet management page
**Description:** Create `src/pages/provider/fleet.tsx`. Bus list with cards showing: license plate, model, capacity, seat configuration visual. Create bus form: select template OR manual config (rows, columns, license plate, model). Edit bus form with seat map editor. Delete with confirmation.

**Acceptance Criteria:**
- [ ] Bus list with visual cards
- [ ] Create dialog: template selector + manual override
- [ ] Bus templates shown as visual cards with seat grid preview
- [ ] Edit mode shows full seat map editor (see TASK-005)
- [ ] Delete with confirmation (warn if schedules reference bus)
- [ ] Component test
- [ ] Typecheck passes

### TASK-005: Create seat map editor component
**Description:** Create `src/components/fleet/seat-map-editor.tsx`. Extends the SeatMap component with edit capabilities: click seat to cycle type (STANDARD → PREMIUM → DISABLED_ACCESSIBLE → BLOCKED → STANDARD), right-click or long-press for type menu. Shows seat count summary. Save button commits changes. Used in fleet page for bus creation and editing.

**Acceptance Criteria:**
- [ ] Click cycles seat type
- [ ] Context menu or type selector for direct type selection
- [ ] Visual distinction for each type (colors, icons)
- [ ] Seat count summary (X standard, Y premium, Z accessible, W blocked)
- [ ] Save triggers bus update mutation
- [ ] Keyboard accessible (Enter to cycle, menu for type selection)
- [ ] Component test
- [ ] Typecheck passes

---

## Schedule Management

### TASK-006: Create schedule management page
**Description:** Create `src/pages/provider/schedules.tsx`. List with filter bar (by route, bus, status, date range). Schedule cards showing: route name, bus info, departure/arrival times, driver assignment, days of week, booking count. Create form: select route, bus, driver (optional), departure/arrival times, days of week multi-select or specific date, base price. Edit: assign/unassign driver, change status. Cancel with confirmation.

**Acceptance Criteria:**
- [ ] Schedule list with filter bar
- [ ] Filters: route dropdown, bus dropdown, status toggle, date range
- [ ] Schedule cards with all info
- [ ] Create form with proper validation
- [ ] Route/bus/driver dropdowns populated from provider's data
- [ ] Days of week selector (multi-toggle: Mon-Sun)
- [ ] Driver assignment/unassignment
- [ ] Cancel schedule with confirmation
- [ ] Component test
- [ ] Typecheck passes

---

## Driver Management

### TASK-007: Create driver management page
**Description:** Create `src/pages/provider/drivers.tsx`. List with driver cards: name, email, phone, assigned schedule count. Create driver form: name, email, password, phone. Delete with confirmation (warns about schedule unassignment).

**Acceptance Criteria:**
- [ ] Driver list with cards showing assigned schedules
- [ ] Create dialog with form + validation
- [ ] Email uniqueness error handled (409 → field error)
- [ ] Delete with confirmation + warning about schedule impact
- [ ] Component test
- [ ] Typecheck passes

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
