# Phase 5: Feature Completeness — Profile, Admin Panel, Provider Analytics, Driver Passengers

**Status**: Pending
**Dependencies**: FE Phase 4 (driver, admin fleet, hardening), BE Phase 4 (all endpoints already implemented)
**Goal**: Implement all remaining frontend pages and hooks to achieve 100% endpoint coverage against the OpenAPI spec. This includes user profile management, full admin panel (users, audit logs), provider profile and analytics, driver passenger manifest, and navbar updates for all new pages.

---

## User Profile

### TASK-001: Create user profile page

Implement a `/profile` page accessible to all authenticated users for viewing and editing their profile.

- [x] Create `pages/profile.tsx` with read-only display of current user info (name, email, phone, role, avatar, member since)
- [x] Add edit mode with React Hook Form + Zod schema matching `UserUpdate` spec (name: max 100, phone: max 20, avatarUrl: uri max 2048)
- [x] Call `PATCH /api/v1/auth/me` on submit, update auth context user state on success
- [x] Show toast on success/failure, map field errors from RFC 9457 to form fields
- [x] Loading skeleton, error state with retry
- [x] Add "Profile" link to navbar for all authenticated users (all roles)
- [x] Add `/profile` route in router.tsx inside AuthGuard
- [x] Component tests: render profile, edit mode toggle, form validation, successful update, API error handling, field error mapping
- [x] Typecheck passes, lint clean

---

## Provider Features

### TASK-002: Create provider profile page

Implement a `/provider/profile` page for providers to view their company information.

- [x] Create `pages/provider/profile.tsx` showing provider details: name, logo, contactEmail, contactPhone, status (APPROVED/PENDING badge), createdAt
- [x] Create `useProviderProfile` hook calling `GET /api/v1/providers/me`, typed from OpenAPI spec, query key in keys.ts
- [x] Show pending status with warning banner ("Your provider account is pending approval")
- [x] Loading skeleton, error state with retry
- [x] Add "Profile" nav link to PROVIDER role in navbar-links.ts
- [x] Add `/provider/profile` route in router.tsx
- [x] Component tests: render profile, pending status banner, loading/error states
- [x] Typecheck passes, lint clean

### TASK-003: Integrate provider analytics into dashboard

The provider dashboard exists but does not call `GET /api/v1/provider/analytics`. Wire up real analytics data.

- [x] Create `useProviderAnalytics` hook calling `GET /api/v1/provider/analytics`, typed from OpenAPI spec
- [x] Update `pages/provider/dashboard.tsx` to use real analytics: totalBookings, totalRevenue, averageOccupancy, revenueByRoute[]
- [x] Replace any hardcoded/placeholder stat cards with live data
- [x] Show revenue-by-route breakdown (table or bar chart using plain HTML/CSS — no chart library)
- [x] Loading skeleton for analytics section, error state with retry
- [x] Component tests: renders analytics data, loading state, error state, empty revenue-by-route
- [x] Typecheck passes, lint clean

---

## Driver Features

### TASK-004: Create driver passenger manifest

Implement passenger list view on the driver trip detail page.

- [x] Create `useDriverTripPassengers` hook calling `GET /api/v1/driver/trips/{scheduleId}/passengers` with date query param, typed from OpenAPI spec, query key in keys.ts
- [x] Add passenger list section to `pages/driver/trip-detail.tsx` or create `components/driver/passenger-list.tsx` sub-component (respect 500 line limit)
- [x] Show each passenger: name, boardingStop, alightingStop, seatLabels, booking status
- [x] Show total passenger count and capacity
- [x] Empty state when no passengers booked
- [x] Loading skeleton for passenger section
- [x] Component tests: render passenger list, empty state, loading state, multiple passengers with different stops
- [x] Typecheck passes, lint clean

---

## Admin Panel

### TASK-005: Create admin hooks for users and audit logs

Create all remaining admin hooks needed for the admin panel.

- [x] Create `useAdminUsers` hook: `GET /api/v1/admin/users` with page, pageSize, role, status filters, typed from OpenAPI spec
- [x] Create `useUpdateUserStatus` mutation hook: `PATCH /api/v1/admin/users/{id}/status` with status body, invalidates admin user queries on success, toast on success/failure
- [x] Create `useForceLogout` mutation hook: `DELETE /api/v1/admin/users/{id}/sessions`, invalidates admin user queries on success, toast on success/failure
- [x] Create `useAuditLogs` hook: `GET /api/v1/admin/audit-logs` with page, pageSize, userId, action, dateFrom, dateTo filters, typed from OpenAPI spec
- [x] Add query key factories for admin users and audit logs in keys.ts
- [x] JSDoc on all exports, unit tests for each hook
- [x] Typecheck passes, lint clean

### TASK-006: Create admin dashboard page

Replace the placeholder admin index page with a real dashboard.

- [x] Create `pages/admin/dashboard.tsx` replacing PlaceholderPage at `/admin` index route
- [x] Show summary cards: total users (by role), total providers, total buses, total active schedules
- [x] Quick action links to Users, Fleet, Audit Logs sub-pages
- [x] Loading skeleton, error state with retry
- [x] Update router.tsx to use AdminDashboardPage instead of PlaceholderPage
- [x] Component tests: render dashboard, stat cards, navigation links, loading/error states
- [x] Typecheck passes, lint clean

### TASK-007: Create admin user management page

Implement `/admin/users` page for managing platform users.

- [x] Create `pages/admin/users.tsx` with paginated user table/list
- [x] Filter bar: role dropdown (PASSENGER/PROVIDER/DRIVER/ADMIN), status dropdown (ACTIVE/SUSPENDED/LOCKED)
- [x] Each user row shows: name, email, role badge, status badge, provider name (if applicable), createdAt
- [x] Action buttons per user:
  - Suspend (ACTIVE → SUSPENDED) with confirmation dialog
  - Unsuspend (SUSPENDED → ACTIVE) with confirmation dialog
  - Unlock (LOCKED → ACTIVE) with confirmation dialog
  - Force logout with confirmation dialog
- [x] Disable actions on the current admin's own row (cannot suspend/logout yourself)
- [x] Pagination controls
- [x] Loading skeleton, error state with retry, empty state
- [x] Add "Users" nav link to ADMIN role in navbar-links.ts
- [x] Add `/admin/users` route in router.tsx
- [x] Component tests: render user list, filter by role, filter by status, suspend/unsuspend/unlock actions, force logout, confirmation dialogs, pagination, self-action prevention, loading/error/empty states
- [x] Typecheck passes, lint clean

### TASK-008: Create admin audit log page

Implement `/admin/audit-logs` page for viewing system audit trail.

- [x] Create `pages/admin/audit-logs.tsx` with paginated audit log table
- [x] Filter bar: userId text input, action dropdown, dateFrom date picker, dateTo date picker
- [x] Each row shows: timestamp (formatted), user email/name, action, resource, resourceId, ipAddress
- [x] Expandable row detail showing full metadata JSON (if present) and userAgent
- [x] Pagination controls
- [x] Loading skeleton, error state with retry, empty state
- [x] Add "Audit Logs" nav link to ADMIN role in navbar-links.ts
- [x] Add `/admin/audit-logs` route in router.tsx
- [x] Component tests: render audit log list, filter by date range, filter by action, expandable detail, pagination, loading/error/empty states
- [x] Typecheck passes, lint clean

---

## Navigation & Routing

### TASK-009: Update navbar and router for all new pages

Wire up all new pages in the router and navbar.

- [x] Update `navbar-links.ts`:
  - Add `{ label: 'Profile', href: '/provider/profile', roles: ['PROVIDER'] }` after Dashboard
  - Add `{ label: 'Dashboard', href: '/admin', roles: ['ADMIN'] }` before Fleet
  - Add `{ label: 'Users', href: '/admin/users', roles: ['ADMIN'] }` after Fleet
  - Add `{ label: 'Audit Logs', href: '/admin/audit-logs', roles: ['ADMIN'] }` after Users
  - Add universal Profile link for all authenticated users (consider user menu dropdown or separate link)
- [x] Update `router.tsx`:
  - Add `/profile` route inside AuthGuard (all roles)
  - Add `/provider/profile` route inside Provider RoleGuard
  - Replace admin index `PlaceholderPage` with `AdminDashboardPage`
  - Add `/admin/users` route inside Admin RoleGuard
  - Add `/admin/audit-logs` route inside Admin RoleGuard
- [x] Lazy-load all new pages with `React.lazy`
- [x] Verify no dead links remain (PlaceholderPage no longer used as a route target)
- [x] Component tests: verify navbar shows correct links per role, verify all routes render
- [x] Typecheck passes, lint clean

---

## Quality Gates

### TASK-010: Phase 5 quality gates and coverage

Run all quality gates and fix any issues introduced by Phase 5.

- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors (warnings acceptable for known react-hooks/incompatible-library)
- [x] `npm run format:check` — passes (run `format:fix` if needed)
- [x] `npm run test` — all tests pass (1266 tests, 73 files)
- [x] `npm run test:coverage` — meets 90% threshold (stmts 95.38%, branches 90.12%, funcs 96.15%, lines 96.36%)
- [x] `npm run build` — production build succeeds
- [x] `npm run api:check` — all frontend API calls reference valid spec endpoints, 96.1% coverage
- [x] Zero `any` types in new code
- [x] Zero `console.log` in new code
- [x] Zero raw `fetch()` calls — all API calls through typed client
- [x] JSDoc on all new exports
- [x] All new pages have loading skeletons, error states with retry, empty states
- [x] All new forms use Zod schemas matching OpenAPI spec constraints
- [x] WCAG 2.1 AA: semantic HTML, aria-labels on interactive elements, keyboard navigable
- [x] Verify endpoint coverage: `api:check` should report ≥95% spec endpoint coverage (up from ~87%)

---

## Pre-existing Issues (Fix Before or During Phase 5)

### TASK-011: Fix pre-existing quality gate failures

Address existing failures that block clean quality gates.

- [x] Fix `apps/web/src/components/fleet/seat-map-editor.test.tsx` — remove unused `beforeEach` import and `SeatType` type (already fixed, verify committed)
- [x] Run `npm run format:fix` in apps/web to fix 28 files with formatting issues
- [x] Fix frontend coverage to meet 90% threshold:
  - Branch coverage 82.89% → 90.12% ✓
  - Function coverage 89.55% → 96.15% ✓
  - Statement coverage 89.88% → 95.38% ✓
