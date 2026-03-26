# Phase 1: Frontend Foundation — Scaffold, API Client, Auth, Shell

**Status**: Pending
**Dependencies**: BE Phase 1 (OpenAPI spec designed, auth endpoints available)
**Goal**: Set up Vite + React frontend with TypeScript strict, generate typed API client from the shared OpenAPI spec, implement auth flow, app shell with role-based navigation, and quality gates.

---

## Scaffold & Tooling

### ~~TASK-001: Initialize Vite + React + TypeScript strict~~ ✅

### ~~TASK-002: Configure Tailwind CSS + shadcn/ui — replicate existing design~~ ✅

### ~~TASK-003: Configure ESLint, Prettier, and quality gates~~ ✅

### ~~TASK-004: Set up Vitest + React Testing Library~~ ✅

---

## API Client (Generated from OpenAPI Spec)

### ~~TASK-005: Set up OpenAPI type generation~~ ✅

### ~~TASK-006: Create typed API client~~ ✅

### ~~TASK-007: Create React Query configuration and key factories~~ ✅

---

## Auth Flow

### ~~TASK-008: Create auth context and hooks with secure token handling~~ ✅

### ~~TASK-009: Create login page~~ ✅

### ~~TASK-010: Create register page~~ ✅

### ~~TASK-011: Create forgot password and reset password pages~~ ✅

### ~~TASK-012: Create change password page~~ ✅

---

## App Shell & Navigation

### ~~TASK-013: Create React Router setup with auth guards~~ ✅

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
