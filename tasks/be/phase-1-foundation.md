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

### TASK-006: Split OpenAPI spec into multi-file structure
**Description:** The single `spec/openapi.yaml` is ~4000 lines. Split it into a multi-file structure using `$ref` references:
```
spec/
├── openapi.yaml              # Root file — info, servers, security, path refs only
├── paths/
│   ├── auth.yaml             # /api/v1/auth/* paths
│   ├── providers.yaml        # /api/v1/providers/* paths
│   ├── routes.yaml           # /api/v1/routes/* paths
│   ├── buses.yaml            # /api/v1/buses/* paths
│   ├── drivers.yaml          # /api/v1/drivers/* paths
│   ├── schedules.yaml        # /api/v1/schedules/* paths
│   ├── search.yaml           # /api/v1/search, /api/v1/trips/* paths
│   ├── bookings.yaml         # /api/v1/bookings/* paths
│   ├── tracking.yaml         # /api/v1/tracking/* paths
│   ├── delays.yaml           # /api/v1/delays/* paths
│   ├── driver-trips.yaml     # /api/v1/driver/trips/* paths
│   └── admin.yaml            # /api/v1/admin/* paths
├── components/
│   ├── schemas/
│   │   ├── auth.yaml         # User, LoginRequest, RegisterRequest, TokenPair, etc.
│   │   ├── provider.yaml     # Provider schema
│   │   ├── transport.yaml    # Route, Stop, Bus, Seat, SeatType, etc.
│   │   ├── schedule.yaml     # Schedule, StopTime, ScheduleStatus, etc.
│   │   ├── booking.yaml      # Booking, BookingStatus, CreateBookingRequest, etc.
│   │   ├── tracking.yaml     # BusTracking, TrackingUpdate
│   │   ├── delay.yaml        # Delay, DelayReason, CreateDelayRequest
│   │   ├── search.yaml       # SearchResult, TripDetail, SeatAvailability
│   │   ├── admin.yaml        # Admin-specific schemas
│   │   └── common.yaml       # ErrorResponse, PaginationMeta, ApiResponse wrappers
│   ├── parameters/
│   │   └── common.yaml       # Reusable query params (page, pageSize, id path param)
│   ├── responses/
│   │   └── errors.yaml       # Reusable error responses (400, 401, 403, 404, 409, 423, 429)
│   └── securitySchemes.yaml  # Bearer JWT definition
└── .redocly.yaml             # Linter config
```
The root `openapi.yaml` should contain only info, servers, security, and `$ref` pointers to path files. Each path file contains the operations for that domain. Each schema file contains the schemas for that domain. Reusable error responses and parameters are shared. After splitting, the spec must still validate with `npx @redocly/cli lint spec/openapi.yaml`.

**Acceptance Criteria:**
- [ ] Root `openapi.yaml` is under 100 lines (only refs)
- [ ] 12 path files in `spec/paths/` (one per domain)
- [ ] 10 schema files in `spec/components/schemas/` (one per domain + common)
- [ ] Reusable error responses in `spec/components/responses/errors.yaml`
- [ ] Reusable parameters in `spec/components/parameters/common.yaml`
- [ ] Security scheme in `spec/components/securitySchemes.yaml`
- [ ] All `$ref` pointers resolve correctly
- [ ] `npx @redocly/cli lint spec/openapi.yaml` passes with zero errors
- [ ] No content lost — bundled output identical to original single file

### TASK-007: Add spec validation tooling and npm scripts
**Description:** Install `@redocly/cli` as root devDep. Add root npm scripts: `spec:lint` (validates split spec), `spec:preview` (serves Redoc preview), `spec:bundle` (bundles split files into single `spec/dist/openapi.json` for consumers — FE type generation, Swagger UI). Create `spec/.redocly.yaml` config with rules (no-unused-components, no-empty-servers, etc.). Add `spec/dist/` to `.gitignore`. Verify the complete spec passes linting.

**Acceptance Criteria:**
- [ ] `@redocly/cli` installed as root devDep
- [ ] `npm run spec:lint` validates the split OpenAPI spec
- [ ] `npm run spec:bundle` outputs `spec/dist/openapi.json` (single bundled file)
- [ ] `npm run spec:preview` serves interactive Redoc docs
- [ ] `.redocly.yaml` config with recommended rules
- [ ] `spec/dist/` in `.gitignore`
- [ ] Complete spec passes lint with zero errors

---

## Backend Scaffold

### TASK-008: Set up Fastify 5 with TypeScript strict
**Description:** In `apps/api/`, install Fastify 5, TypeScript 5.5+, `tsx` for dev, `tsc` + `tsc-alias` for build. Configure `tsconfig.json` with strict mode, path aliases (`@/` → `src/`). Create `src/app.ts` (Fastify app factory with plugin registration), `src/server.ts` (entry point with graceful shutdown). Add npm scripts: `dev`, `build`, `start`, `typecheck`.

**Acceptance Criteria:**
- [ ] `apps/api/tsconfig.json` with strict: true, paths configured
- [ ] `src/app.ts` exports `buildApp()` factory function
- [ ] `src/server.ts` starts server with graceful shutdown (SIGINT/SIGTERM)
- [ ] `npm run dev` starts with tsx watch
- [ ] `npm run build` compiles with tsc + tsc-alias
- [ ] `npm run typecheck` passes with zero errors
- [ ] JSDoc on exported functions

### TASK-009: Install and configure core dependencies
**Description:** Install: `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/swagger`, `@fastify/swagger-ui`, `zod`, `bcryptjs`, `jsonwebtoken`, `date-fns`. Dev deps: `vitest`, `supertest`, `@types/*`, `eslint`, `prettier`, `eslint-plugin-jsdoc`, `@vitest/coverage-v8`. Configure ESLint with TypeScript + complexity rules (max-lines: 500, max-lines-per-function: 250, complexity: 15, max-depth: 4, jsdoc/require-jsdoc on exports). Configure Prettier (semi, singleQuote, printWidth: 100).

**Acceptance Criteria:**
- [ ] All dependencies installed in `apps/api/package.json`
- [ ] `.eslintrc.json` with complexity rules as warnings, jsdoc enforcement
- [ ] `.prettierrc` configured
- [ ] `npm run lint` works
- [ ] `npm run format:check` works

### TASK-010: Set up Vitest with test infrastructure
**Description:** Configure Vitest in `apps/api/`. Create `vitest.config.ts` with path aliases and v8 coverage. Create `src/test/setup.ts` for global test setup. Create `src/test/helpers.ts` with `createTestApp()` (builds Fastify app with test config), `createAuthHeader(userId, role, providerId?)` (creates test JWT), `createTestUser(overrides?)` factory. Add npm scripts: `test`, `test:watch`, `test:coverage`, `test:integration`.

**Acceptance Criteria:**
- [ ] `vitest.config.ts` configured with path aliases and v8 coverage provider
- [ ] `src/test/helpers.ts` exports all test utilities with proper types
- [ ] `npm run test` runs unit tests only
- [ ] `npm run test:integration` runs integration tests
- [ ] `npm run test:coverage` produces coverage report (target: 85%)
- [ ] JSDoc on all exported helpers

### TASK-011: Create project architecture directories and shared utilities
**Description:** Create the layered architecture under `apps/api/src/`:
```
api/plugins/       api/health/        api/auth/
application/services/
domain/errors/     domain/auth/       domain/users/
infrastructure/config/   infrastructure/prisma/
shared/            test/
```
Create `src/infrastructure/config/env.ts` with Zod-validated env vars (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, PORT, NODE_ENV, CORS_ORIGIN). Create `src/shared/types.ts` with `ApiResponse<T>`, `PaginatedResponse<T>`, `PaginationMeta`. Create `src/shared/schemas.ts` with `paginationQuerySchema`, `idParamSchema`. Create `src/shared/pagination.ts` with `buildPaginationMeta()` and `parsePagination()`.

**Acceptance Criteria:**
- [ ] All directories created
- [ ] `env.ts` validates all env vars with Zod, throws on missing
- [ ] `shared/types.ts` exports API envelope types matching OpenAPI spec
- [ ] `shared/schemas.ts` exports reusable Zod schemas
- [ ] `shared/pagination.ts` exports pagination helpers
- [ ] Unit tests for pagination helpers
- [ ] Typecheck passes
- [ ] JSDoc on all exports

### TASK-012: Create error handling infrastructure
**Description:** Create `src/domain/errors/error-codes.ts` with all error codes as const enum (AUTH_INVALID_CREDENTIALS, AUTH_TOKEN_EXPIRED, AUTH_EMAIL_TAKEN, RESOURCE_NOT_FOUND, VALIDATION_ERROR, FORBIDDEN, CONFLICT, SEAT_CONFLICT, INTERNAL_ERROR, RATE_LIMITED). Create `src/domain/errors/app-error.ts` with `AppError` class. Create `src/api/plugins/error-handler.ts` plugin returning RFC 9457 Problem Details matching the `ErrorResponse` schema from the OpenAPI spec.

**Acceptance Criteria:**
- [ ] `ErrorCodes` enum with all codes
- [ ] `AppError` class with statusCode, code, detail, errors[] properties
- [ ] Error handler returns format matching spec: `{ type, title, status, detail, code, errors? }`
- [ ] Zod validation errors mapped to `errors: [{ field, message }]`
- [ ] Unknown errors return 500 without leaking internals
- [ ] Unit tests for error handler and AppError
- [ ] Typecheck passes

### TASK-013: Create health check and Swagger setup
**Description:** Register `@fastify/swagger` + `@fastify/swagger-ui` in `app.ts`. Import the bundled OpenAPI spec and serve it. Create `src/api/health/routes.ts` with `GET /health` (not in spec — internal). Swagger UI at `/docs`, JSON at `/docs/json`. Add `npm run api:validate` script that compares implemented routes against the spec.

**Acceptance Criteria:**
- [ ] Swagger UI at `/docs` serves the OpenAPI spec
- [ ] `GET /health` returns `{ status: 'ok', timestamp, uptime }`
- [ ] Integration test for health endpoint with Supertest
- [ ] Typecheck passes

---

## Prisma Schema (PostgreSQL)

### TASK-014: Set up Prisma with PostgreSQL
**Description:** Install `prisma` and `@prisma/client`. Create `prisma/schema.prisma` with PostgreSQL provider. Create `src/infrastructure/prisma/client.ts` with singleton (query logging in dev). Add scripts: `db:generate`, `db:push`, `db:migrate`, `db:seed`, `db:studio`.

**Acceptance Criteria:**
- [ ] `prisma/schema.prisma` with PostgreSQL datasource
- [ ] Prisma client singleton exported
- [ ] All db scripts work
- [ ] Typecheck passes

### TASK-015: Create User, Provider, and security-related models
**Description:** User: id (cuid), email (unique), name, passwordHash, role (enum PASSENGER/PROVIDER/DRIVER/ADMIN), phone, avatarUrl, preferences (Json), providerId (FK nullable), status (enum ACTIVE/SUSPENDED/LOCKED default ACTIVE), failedLoginAttempts (Int default 0), lockedUntil (DateTime nullable), createdAt, updatedAt. Provider: id (cuid), name, logo, contactEmail, contactPhone, status (enum APPROVED/PENDING), createdAt, updatedAt. RefreshToken: id (cuid), token (unique, hashed), userId (FK), expiresAt (DateTime), revokedAt (DateTime nullable), createdAt. PasswordResetToken: id (cuid), token (unique, hashed), userId (FK), expiresAt (DateTime), usedAt (DateTime nullable), createdAt. AuditLog: id (cuid), userId (FK nullable), action (String), resource (String), resourceId (String nullable), ipAddress (String nullable), userAgent (String nullable), metadata (Json nullable), createdAt. Indexes on User.email (unique), User.providerId, User.role, RefreshToken.token, PasswordResetToken.token, AuditLog.userId+createdAt.

**Acceptance Criteria:**
- [ ] User model with status enum (ACTIVE, SUSPENDED, LOCKED) and lockout fields
- [ ] Provider model with status enum
- [ ] RefreshToken model (hashed tokens, expiry, revocation tracking)
- [ ] PasswordResetToken model (hashed tokens, expiry, single-use)
- [ ] AuditLog model for security event tracking
- [ ] Role enum matching OpenAPI `Role` enum
- [ ] UserStatus enum (ACTIVE, SUSPENDED, LOCKED)
- [ ] Proper indexes and relations
- [ ] Cascade delete RefreshTokens and PasswordResetTokens when User deleted
- [ ] `npm run db:generate` succeeds

### TASK-016: Create transport entity models
**Description:** Route (id, name, providerId FK). Stop (id, name, lat, lng, orderIndex, routeId FK cascade). Bus (id, licensePlate unique, model, capacity, rows, columns, providerId FK). Seat (id, row, column, label, type enum, price Float default 0, isEnabled Boolean default true, busId FK cascade). Add all indexes.

**Acceptance Criteria:**
- [ ] All models match OpenAPI schemas
- [ ] Bus.licensePlate is unique
- [ ] Cascade deletes on Stop→Route and Seat→Bus
- [ ] SeatType enum matches spec
- [ ] `npm run db:generate` succeeds

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
