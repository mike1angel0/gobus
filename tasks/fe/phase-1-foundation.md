# Phase 1: Frontend Foundation — Scaffold, API Client, Auth, Shell

**Status**: Pending
**Dependencies**: BE Phase 1 (OpenAPI spec designed, auth endpoints available)
**Goal**: Set up Vite + React frontend with TypeScript strict, generate typed API client from the shared OpenAPI spec, implement auth flow, app shell with role-based navigation, and quality gates.

---

## Scaffold & Tooling

### ~~TASK-001: Initialize Vite + React + TypeScript strict~~ ✅

### TASK-002: Configure Tailwind CSS + shadcn/ui — replicate existing design
**Description:** Install and configure Tailwind CSS v3.4. **Copy the exact design system from the existing Next.js app** — read `tailwind.config.ts` and `src/app/globals.css` from the project root to replicate: custom colors (primary blue #3B82F6, accent green #10B981, dark slate palette dark-50 through dark-950), glass-morphism effects (backdrop-blur, border opacity), gradient text. Install shadcn/ui with the dark theme. Create `src/components/ui/` directory. Port ALL utility classes from existing `globals.css`: `.glass`, `.glass-card`, `.btn-primary`, `.btn-accent`, `.btn-secondary`, `.input-field`, and any others found. The new app must be visually identical to the existing one.

**Acceptance Criteria:**
- [ ] Tailwind theme colors copied exactly from existing `tailwind.config.ts`
- [ ] ALL utility classes from existing `globals.css` ported (`.glass`, `.glass-card`, `.btn-primary`, `.btn-accent`, `.btn-secondary`, `.input-field`, etc.)
- [ ] shadcn/ui initialized with dark theme
- [ ] `src/components/ui/` directory with shadcn base components (button, input, card, dialog, toast)
- [ ] Visual comparison: new app shell matches existing app's look and feel
- [ ] Typecheck passes

### TASK-003: Configure ESLint, Prettier, and quality gates
**Description:** Install and configure: ESLint with TypeScript + React + a11y + complexity rules (max-lines: 500, max-lines-per-function: 250, complexity: 15, max-depth: 4, jsdoc on exports). Prettier (semi, singleQuote, printWidth: 100). Add npm scripts: `lint`, `format:check`, `format:fix`.

**Acceptance Criteria:**
- [ ] ESLint with complexity and jsdoc rules
- [ ] eslint-plugin-jsx-a11y for accessibility
- [ ] Prettier configured
- [ ] `npm run lint` works
- [ ] `npm run format:check` works

### TASK-004: Set up Vitest + React Testing Library
**Description:** Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@vitest/coverage-v8`. Configure `vitest.config.ts` with jsdom environment, path aliases, coverage. Create `src/test/setup.ts` with jest-dom matchers. Create `src/test/helpers.tsx` with `renderWithProviders()` (wraps component in QueryClient + Router + Auth context). Add scripts: `test`, `test:watch`, `test:coverage`.

**Acceptance Criteria:**
- [ ] Vitest configured with jsdom and path aliases
- [ ] `renderWithProviders` helper wraps all necessary providers
- [ ] `npm run test` runs all tests
- [ ] `npm run test:coverage` produces report (target: 90%)
- [ ] JSDoc on test helpers

---

## API Client (Generated from OpenAPI Spec)

### TASK-005: Set up OpenAPI type generation
**Description:** Install `openapi-typescript` as devDep. Create `npm run api:sync` script that: reads `../../spec/dist/openapi.json` (the bundled spec), generates TypeScript types into `src/api/generated/types.ts`. Create `src/api/generated/.gitkeep`. Document the workflow: spec changes → `npm run spec:bundle` (root) → `npm run api:sync` (web) → types regenerated.

**Acceptance Criteria:**
- [ ] `openapi-typescript` installed
- [ ] `npm run api:sync` generates types from OpenAPI spec
- [ ] Generated types include all request/response schemas
- [ ] Generated types include all path definitions
- [ ] Workflow documented in apps/web CLAUDE.md

### TASK-006: Create typed API client
**Description:** Install `openapi-fetch`. Create `src/api/client.ts` with typed API client: configures base URL from env (VITE_API_URL), attaches Bearer token from auth context, handles RFC 9457 error responses, auto-redirects to login on 401. Create `src/api/errors.ts` with `ApiError` class and error handling utilities. Create `src/api/hooks.ts` with `useApiClient()` hook that returns configured client.

**Acceptance Criteria:**
- [ ] Typed client using `openapi-fetch` with generated types
- [ ] Auth token automatically attached to requests
- [ ] 401 responses trigger auth redirect
- [ ] RFC 9457 errors parsed into `ApiError` instances
- [ ] `useApiClient()` hook returns configured client
- [ ] Unit tests for error parsing
- [ ] JSDoc on all exports
- [ ] Typecheck passes

### TASK-007: Create React Query configuration and key factories
**Description:** Create `src/providers/query-provider.tsx` with QueryClient configuration (staleTime: 30s, retry: 1, refetchOnWindowFocus: false). Create `src/api/keys.ts` with query key factories: `authKeys`, `routeKeys`, `busKeys`, `scheduleKeys`, `bookingKeys`, `trackingKeys`, `searchKeys`, `driverKeys`, `delayKeys`, `adminKeys`. Each factory: `.all`, `.lists(filters?)`, `.detail(id)`.

**Acceptance Criteria:**
- [ ] QueryClient configured with sensible defaults
- [ ] QueryClientProvider wraps app
- [ ] All query key factories defined with proper structure
- [ ] JSDoc on key factories
- [ ] Typecheck passes

---

## Auth Flow

### TASK-008: Create auth context and hooks with secure token handling
**Description:** Create `src/contexts/auth-context.tsx` with AuthProvider. **Secure token storage:** access token in memory only (never localStorage/sessionStorage — XSS-safe), refresh token in httpOnly cookie (if API supports) or localStorage as fallback. Methods: `login(email, password)`, `register(data)`, `logout()` (calls POST /auth/logout to revoke server-side), `refreshToken()`, `changePassword(current, new)`, `forgotPassword(email)`, `resetPassword(token, newPassword)`. Create `src/hooks/useAuth.ts`. Auto-refresh access token before expiry (use JWT exp claim, refresh 1 minute before expiry). Auto-attach access token to API client via interceptor.

**Acceptance Criteria:**
- [ ] Access token stored in memory only (not localStorage)
- [ ] Refresh token in localStorage (or httpOnly cookie if supported)
- [ ] `login` calls POST /auth/login, stores tokens, fetches user profile
- [ ] `register` calls POST /auth/register, stores tokens
- [ ] `logout` calls POST /auth/logout (revokes refresh token server-side), then clears local state
- [ ] `changePassword` calls POST /auth/change-password
- [ ] `forgotPassword` calls POST /auth/forgot-password
- [ ] `resetPassword` calls POST /auth/reset-password
- [ ] Auto-refresh: reads JWT exp, refreshes 1 min before expiry
- [ ] On 401 during refresh → full logout (session expired)
- [ ] On 423 → show "Account locked" message
- [ ] On 403 (suspended) → show "Account suspended" message, logout
- [ ] Unit tests for auth state transitions including error scenarios
- [ ] JSDoc on all exports
- [ ] Typecheck passes

### TASK-009: Create login page
**Description:** Create `src/pages/auth/login.tsx`. Form with email + password fields. Zod validation (email format, password min 6 chars). React Hook Form + zodResolver. Calls `login()` from auth context. Redirects to role-appropriate dashboard on success. Shows field-level errors from API (RFC 9457 errors mapped to fields). Loading state on submit button.

**Acceptance Criteria:**
- [ ] Form with Zod validation + React Hook Form
- [ ] API errors mapped to form fields
- [ ] Loading spinner on submit
- [ ] Redirects on success (PROVIDER → /provider, DRIVER → /driver, ADMIN → /admin, PASSENGER → /)
- [ ] Accessible: labels, aria attributes, keyboard navigable
- [ ] Component test with RTL
- [ ] Typecheck passes

### TASK-010: Create register page
**Description:** Create `src/pages/auth/register.tsx`. Role toggle (PASSENGER / PROVIDER). Shared fields: name, email, password, phone. Provider-specific: providerName. Zod validation including password strength (min 8, uppercase+lowercase+digit). Password strength indicator. React Hook Form. Auto-login after registration.

**Acceptance Criteria:**
- [ ] Role toggle between PASSENGER and PROVIDER
- [ ] Conditional provider fields shown when PROVIDER selected
- [ ] Password strength validation: min 8 chars, uppercase, lowercase, digit
- [ ] Visual password strength indicator (weak/fair/strong)
- [ ] Zod validation with meaningful error messages
- [ ] API errors mapped to fields (e.g., email taken → email field error)
- [ ] Auto-login after successful registration
- [ ] Accessible
- [ ] Component test
- [ ] Typecheck passes

### TASK-011: Create forgot password and reset password pages
**Description:** Create `src/pages/auth/forgot-password.tsx` — email input form, calls `forgotPassword()`, shows success message ("If an account exists, we've sent a reset link") regardless of whether email exists (prevents enumeration). Create `src/pages/auth/reset-password.tsx` — reads token from URL query param, new password + confirm password form with strength validation, calls `resetPassword()`, redirects to login on success.

**Acceptance Criteria:**
- [ ] Forgot password form with email input
- [ ] Success message always shown (no email enumeration)
- [ ] Reset password reads `?token=` from URL
- [ ] New password + confirm password fields
- [ ] Password strength validation (same rules as register)
- [ ] Expired/invalid token shows clear error with link back to forgot-password
- [ ] Redirects to login on successful reset
- [ ] Accessible
- [ ] Component tests for both pages
- [ ] Typecheck passes

### TASK-012: Create change password page
**Description:** Create `src/pages/auth/change-password.tsx` (authenticated). Form: current password, new password, confirm new password. Calls `changePassword()`. Shows success toast and stays on page. Wrong current password shows field-level error.

**Acceptance Criteria:**
- [ ] Requires authentication
- [ ] Current password field
- [ ] New password + confirm with strength validation
- [ ] API error for wrong current password mapped to field
- [ ] Success toast
- [ ] Accessible
- [ ] Component test
- [ ] Typecheck passes

---

## App Shell & Navigation

### TASK-013: Create React Router setup with auth guards
**Description:** Create `src/router.tsx` with React Router v6. Define all routes:
- Public: `/`, `/search`, `/trip/:id`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`
- Authenticated: `/auth/change-password`
- Passenger (auth): `/my-trips`
- Provider (auth+role): `/provider/*` (dashboard, routes, fleet, schedules, drivers, tracking)
- Driver (auth+role): `/driver/*` (trips, trip/:id, delay)
- Admin (auth+role): `/admin/*` (fleet)

Create `src/components/guards/auth-guard.tsx` (redirects to login if unauthenticated) and `src/components/guards/role-guard.tsx` (redirects to / if wrong role). Use React Router's `<Outlet>` pattern for nested layouts.

**Acceptance Criteria:**
- [ ] All routes defined with lazy loading (React.lazy + Suspense)
- [ ] AuthGuard redirects unauthenticated users to /auth/login
- [ ] RoleGuard checks user role, redirects on mismatch
- [ ] Guards run before page render (no flash of protected content)
- [ ] Public routes accessible without auth
- [ ] Component tests for guards
- [ ] Typecheck passes

### TASK-014: Create Navbar component
**Description:** Create `src/components/layout/navbar.tsx`. Responsive with mobile hamburger menu. Role-based navigation links: PASSENGER (Home, Search, My Trips), PROVIDER (Dashboard, Routes, Fleet, Schedules, Drivers, Tracking), DRIVER (Trips, History), ADMIN (Fleet). Shows user name + sign out. Logo with link to home.

**Acceptance Criteria:**
- [ ] Responsive: desktop horizontal nav, mobile hamburger menu
- [ ] Role-based link visibility
- [ ] Active link highlighting
- [ ] User info + sign out button (authenticated)
- [ ] Login/Register links (unauthenticated)
- [ ] Accessible: ARIA labels, keyboard navigation, focus management on mobile menu
- [ ] Component test with different roles
- [ ] Typecheck passes

### TASK-015: Create app layout and home page
**Description:** Create `src/components/layout/app-layout.tsx` wrapping Navbar + Outlet + ToastContainer. Create `src/pages/home.tsx` with hero section, search form, popular routes preview. Use the dark glass-morphism design language.

**Acceptance Criteria:**
- [ ] App layout wraps all pages with Navbar
- [ ] Toast notifications configured (react-hot-toast or shadcn toast)
- [ ] Home page with hero, search CTA
- [ ] Responsive design
- [ ] Component test
- [ ] Typecheck passes

---

## Quality & Documentation

### TASK-016: Create CLAUDE.md for frontend
**Description:** Create `apps/web/CLAUDE.md` documenting: tech stack, quick start, project structure, API-first workflow (types generated from spec), patterns (React Query, forms, components), conventions (naming, a11y, JSDoc, zero any), quality gates.

**Acceptance Criteria:**
- [ ] All sections documented
- [ ] API-first workflow explained (spec → api:sync → typed client)
- [ ] Pattern examples for hooks, forms, components
- [ ] Quality gate commands listed

### TASK-017: Run Phase 1 quality gates
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
- [ ] All components accessible (labels, ARIA, keyboard)
