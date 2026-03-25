# Phase 1: Monorepo, OpenAPI Spec & Backend Foundation

**Status**: Pending
**Dependencies**: None
**Goal**: Set up monorepo, design the complete OpenAPI 3.1 spec (shared between BE & FE), scaffold Fastify backend, configure Prisma with PostgreSQL, set up quality gates. The OpenAPI spec is the single source of truth for the API contract.

---

## Monorepo Structure

### TASK-001: Initialize monorepo with shared API spec
**Description:** Create the monorepo layout:
```
transio/
├── spec/                  # Shared OpenAPI spec (source of truth)
│   ├── openapi.yaml       # Main spec file (references components)
│   ├── paths/             # Path definitions split by domain
│   └── components/        # Shared schemas, parameters, responses
├── apps/
│   ├── api/               # Fastify backend
│   └── web/               # React frontend (placeholder for now)
├── tasks/                 # Phase task files
├── scripts/               # Ralph automation scripts
├── package.json           # Root workspaces
└── CLAUDE.md              # Root conventions
```
Set up root `package.json` with npm workspaces (`apps/*`). Keep existing Next.js code in place — it stays as the working app until the new apps are ready, and serves as the design reference (Tailwind theme, glass-morphism components, color palette, globals.css utilities). The new `apps/web/` must replicate the exact same visual design. Add root `.gitignore`, `.editorconfig`.

**Acceptance Criteria:**
- [x] Root `package.json` with `"workspaces": ["apps/*"]`
- [x] `spec/` directory created with placeholder `openapi.yaml`
- [x] `apps/api/package.json` initialized with name `@transio/api`
- [x] `apps/web/package.json` initialized with name `@transio/web`
- [x] Existing Next.js code kept in place as design reference (not moved or deleted)
- [x] Root `.gitignore` updated (node_modules, dist, .env, *.db, coverage/)
- [x] Root `CLAUDE.md` created with monorepo overview and API-first workflow

**TASK-002: Design OpenAPI 3.1 spec — Auth & Users** - Designed complete auth/user schemas (RegisterRequest, LoginRequest, User, Role, UserStatus, ErrorResponse RFC 9457, PaginationMeta, etc.) and all 9 auth paths with request/response/error schemas. Spec validates with zero errors.

**TASK-003: Design OpenAPI spec — Provider & Transport entities** - Designed all transport entity schemas (Provider, Route, Stop, Bus, Seat, Schedule, StopTime, Driver, enums) and 16 provider paths with full request/response/error schemas, pagination, ownership enforcement, and reusable parameters. Spec validates with zero errors.

**TASK-004: Design OpenAPI spec — Passenger, Booking, Search** - Designed SearchResult, SeatAvailability, TripDetail, Booking, BookingWithDetails, CreateBookingRequest schemas and BookingStatus enum. Added 6 paths: search trips (public), trip details with seat availability (public), list/create/get/cancel bookings (authenticated with ownership). Spec validates with zero errors.

**TASK-005: Design OpenAPI spec — Tracking, Delays, Driver, Admin** - Added BusTracking, TrackingUpdate, Delay, DelayReason, CreateDelayRequest, UpdateDelayRequest, DriverTrip, DriverTripDetail, AdminToggleSeatRequest schemas and 9 paths (tracking GET/POST, driver trips GET list/detail, delays GET/POST/PUT, admin buses GET, admin seats PATCH). Total: 40 endpoints. Spec validates with zero errors.

**TASK-006: Split OpenAPI spec into multi-file structure** - Split 3884-line monolithic spec into 12 path files, 10 schema files, reusable parameters/responses/securitySchemes. Root openapi.yaml is 94 lines (refs only). All 29 paths and 80 schemas preserved. Spec lints with zero errors.

**TASK-007: Add spec validation tooling and npm scripts** - Installed @redocly/cli, configured .redocly.yaml with recommended rules + extras, added spec:lint/spec:bundle/spec:preview npm scripts, spec/dist/ in .gitignore. Spec validates with zero errors.

---

## Backend Scaffold

**TASK-008: Set up Fastify 5 with TypeScript strict** - Installed Fastify 5, TypeScript 5 strict, tsx, tsc-alias. Created buildApp() factory, graceful shutdown server, path aliases (@/ → src/). All scripts work: dev, build, start, typecheck.

**TASK-009: Install and configure core dependencies** - Installed all production deps (@fastify/cors, helmet, rate-limit, swagger, swagger-ui, zod, bcryptjs, jsonwebtoken, date-fns) and dev deps (vitest, supertest, @types/*, eslint 10, prettier, eslint-plugin-jsdoc, @vitest/coverage-v8, typescript-eslint). Configured ESLint flat config (eslint.config.mjs) with complexity warnings and JSDoc enforcement. Configured Prettier (.prettierrc). All lint/format scripts work.

**TASK-010: Set up Vitest with test infrastructure** - Configured vitest.config.ts with path aliases (@/ → src/) and v8 coverage (85% thresholds). Created test setup (env vars), helpers (createTestApp, createAuthHeader, createTestUser with JSDoc). Added npm scripts: test, test:watch, test:coverage, test:integration. Separate vitest.integration.config.ts for integration tests. 7 unit tests passing.

**TASK-011: Create project architecture directories and shared utilities** - Created layered architecture directories (api/, application/, domain/, infrastructure/, shared/), Zod-validated env config (env.ts), API envelope types (types.ts), reusable Zod schemas (schemas.ts with pagination/id/dataResponse/paginatedResponse), pagination helpers (pagination.ts). 39 unit tests passing.

**TASK-012: Create error handling infrastructure** - Created ErrorCodes const object (10 codes), AppError class with statusCode/code/detail/errors[], and error-handler Fastify plugin producing RFC 9457 Problem Details responses. Handles AppError, ZodError, Fastify validation errors, and unknown errors (safe 500). 53 unit tests passing.

**TASK-013: Create health check and Swagger setup** - Registered @fastify/swagger (static mode with bundled spec) and @fastify/swagger-ui at /docs. Created GET /health endpoint returning {status, timestamp, uptime}. 4 integration tests passing (health + swagger UI + JSON spec).

---

## Prisma Schema (PostgreSQL)

**TASK-014: Set up Prisma with PostgreSQL** - Installed Prisma 7 with @prisma/adapter-pg driver adapter, created PostgreSQL schema, singleton client with query logging in dev, graceful disconnect in server shutdown, and all db:* npm scripts.

**TASK-015: Create User, Provider, and security-related models** - Created User (with status/lockout fields), Provider (with ProviderStatus), RefreshToken, PasswordResetToken, AuditLog models. Role/UserStatus/ProviderStatus enums matching OpenAPI spec. Cascade deletes, proper indexes, db:generate succeeds.

**TASK-016: Create transport entity models** - Added SeatType enum, Route, Stop, Bus, Seat models with proper FKs, cascade deletes, unique licensePlate, and indexes. db:generate succeeds.

### TASK-017: Create Schedule, Booking, and operational models
**Description:** Schedule (id, routeId, busId, driverId nullable, departureTime, arrivalTime, daysOfWeek, basePrice Float, status enum, tripDate DateTime, createdAt). StopTime (id, scheduleId FK cascade, stopName, arrivalTime, departureTime, orderIndex, priceFromStart Float). Booking (id, orderId unique cuid, userId FK, scheduleId FK, totalPrice Float, status enum, boardingStop, alightingStop, tripDate DateTime, createdAt). BookingSeat (id, bookingId FK cascade, seatLabel, unique constraint on scheduleId+seatLabel+tripDate). Delay (id, scheduleId FK, offsetMinutes Int, reason enum, note, tripDate DateTime, active Boolean, createdAt). BusTracking (id, busId FK unique, lat, lng, speed, heading, scheduleId nullable, currentStopIndex, isActive, tripDate DateTime nullable, updatedAt). Message (id, senderId FK, receiverId FK, content, read Boolean, createdAt).

**Acceptance Criteria:**
- [ ] All models defined with proper types (DateTime not String for dates)
- [ ] BookingSeat normalized model (no comma-separated strings)
- [ ] Unique constraint on BookingSeat(scheduleId, seatLabel, tripDate) prevents double-booking at DB level
- [ ] BusTracking.busId is unique (one tracking record per bus)
- [ ] All enums defined (ScheduleStatus, BookingStatus, DelayReason)
- [ ] All foreign keys indexed
- [ ] Full schema compiles: `npm run db:generate`

### TASK-018: Create initial migration and seed script
**Description:** Run initial migration. Create `prisma/seed.ts` with: 3 providers, 15 cities, 8 routes with stops, 5 buses with seat grids, 15 schedules with stop times and segment pricing, demo accounts (2 passengers, 3 provider admins, 3 drivers, 1 admin) — all passwords hashed with bcryptjs.

**Acceptance Criteria:**
- [ ] Migration file created
- [ ] Seed creates all demo data
- [ ] Passwords hashed (not plaintext)
- [ ] `npm run db:seed` succeeds
- [ ] Typecheck passes

---

## Auth Implementation

### TASK-019: Create auth domain types
**Description:** Create `src/domain/auth/auth.types.ts` and `src/domain/users/user.entity.ts`. Types must match the OpenAPI spec schemas exactly. Include: LoginCredentials, RegisterData, AuthTokenPayload, TokenPair, UserEntity.

**Acceptance Criteria:**
- [ ] All types match OpenAPI schemas
- [ ] JSDoc on all exported types
- [ ] Typecheck passes

### TASK-020: Create auth service with security features
**Description:** Create `src/application/services/auth.service.ts`. Methods:
- `register(data)` — validates password strength (min 8 chars, uppercase+lowercase+digit), creates user (+provider if PROVIDER role), hashes password (bcryptjs cost 12), returns tokens.
- `login(credentials, ipAddress?)` — checks account lockout (lockedUntil), validates credentials, on failure increments failedLoginAttempts (lock account after 5 failures for 15min), on success resets counter, returns tokens+user. Suspended users get 403.
- `logout(userId, refreshToken)` — revokes the specific refresh token.
- `refreshToken(token)` — validates refresh token exists in DB + not revoked + not expired, rotates (revoke old, issue new), returns new token pair.
- `forgotPassword(email)` — generates crypto-random reset token, hashes it, stores in PasswordResetToken (expires in 1h), logs action. Returns void (never reveals if email exists).
- `resetPassword(token, newPassword)` — validates token (exists, not expired, not used), validates password strength, updates user password, marks token as used, revokes all existing refresh tokens.
- `changePassword(userId, currentPassword, newPassword)` — validates current password, validates new password strength, updates, revokes all other refresh tokens.
- `generateTokens(user)` — JWT access (15min) + refresh (7d), stores refresh token hash in DB.

**Acceptance Criteria:**
- [ ] Password strength: min 8 chars, must contain uppercase + lowercase + digit
- [ ] Account lockout: 5 failed attempts → locked for 15 minutes
- [ ] Locked account returns 423 LOCKED
- [ ] Suspended account returns 403 FORBIDDEN
- [ ] Refresh tokens stored as hashed values in DB (not plaintext)
- [ ] Refresh token rotation: old revoked, new issued
- [ ] Password reset tokens: hashed, single-use, 1h expiry
- [ ] `forgotPassword` never reveals whether email exists (timing-safe)
- [ ] `resetPassword` revokes all refresh tokens (forces re-login everywhere)
- [ ] `changePassword` validates current password first
- [ ] Unit tests with mocked Prisma (≥90% coverage on this file)
- [ ] JSDoc on all public methods
- [ ] Typecheck passes

### TASK-021: Create auth plugin and role guards with account status checks
**Description:** Create `src/api/plugins/auth.ts` (decorates request.user, adds app.authenticate preHandler). After JWT validation, check user status from DB: SUSPENDED → 403, LOCKED → 423. Create `src/api/plugins/role-guard.ts` with `requireRole(...roles)`, `requireProvider`, `requireDriver`, `requireAdmin` factories. Proper Fastify type augmentation (zero `as any`).

**Acceptance Criteria:**
- [ ] `request.user` properly typed via Fastify type augmentation
- [ ] Zero `as any` casts
- [ ] 401 for missing/invalid/expired tokens (RFC 9457 format)
- [ ] 403 for insufficient role OR suspended account (RFC 9457 format)
- [ ] 423 for locked account (RFC 9457 format)
- [ ] User status checked on every authenticated request
- [ ] Unit tests for auth plugin and each guard
- [ ] Unit tests for suspended/locked account scenarios
- [ ] Typecheck passes

### TASK-022: Create auth routes
**Description:** Create `src/api/auth/routes.ts` and `src/api/auth/schemas.ts`. Implement all 9 auth endpoints from the OpenAPI spec. Zod schemas must mirror the spec schemas exactly. Register at `/api/v1/auth` prefix.

**Acceptance Criteria:**
- [ ] All 9 endpoints match OpenAPI spec (register, login, refresh, logout, forgot-password, reset-password, change-password, get me, update me)
- [ ] Register validates password strength (Zod regex: uppercase, lowercase, digit, min 8)
- [ ] Login returns 423 for locked accounts, 403 for suspended
- [ ] Logout revokes refresh token
- [ ] Forgot-password always returns 200 (no email enumeration)
- [ ] Reset-password validates token + password strength
- [ ] Change-password requires current password
- [ ] Zod schemas with `.describe()` matching spec field descriptions
- [ ] Integration tests with Supertest for all 9 endpoints
- [ ] Error cases tested (duplicate email, bad credentials, expired token, locked account, weak password, invalid reset token)
- [ ] Typecheck passes

---

## Quality Gates

### TASK-023: Create CLAUDE.md for backend
**Description:** Create `apps/api/CLAUDE.md` documenting: tech stack, quick start, architecture (layered with rules), API-first workflow (spec → implement → validate), API conventions (response/error format), route implementation pattern, service pattern, quality gates, test conventions, env vars table.

**Acceptance Criteria:**
- [ ] All sections documented
- [ ] API-first workflow explained (spec is source of truth)
- [ ] Quality gate commands listed
- [ ] Test conventions (unit vs integration, assertion style)

### TASK-024: Run all Phase 1 quality gates
**Description:** Run and fix: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:coverage`, `npm run build`. Ensure all pass, coverage ≥ 85%, zero `any` in production code, JSDoc on all exports.

**Acceptance Criteria:**
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — passes
- [ ] `npm run test` — all pass
- [ ] `npm run test:coverage` ≥ 85%
- [ ] `npm run build` — succeeds
- [ ] Zero `any` in src/ (excluding test/)
- [ ] JSDoc on all exported functions/classes/methods
- [ ] `npm run spec:lint` — spec validates
