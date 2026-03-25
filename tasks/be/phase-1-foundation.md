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

**TASK-017: Create Schedule, Booking, and operational models** - Added Schedule, StopTime, Booking, BookingSeat, Delay, BusTracking, Message models with proper DateTime types, cascade deletes, indexes on all FKs. BookingSeat has @@unique([scheduleId, seatLabel, tripDate]) for double-booking prevention. BusTracking.busId is @unique. Added ScheduleStatus, BookingStatus, DelayReason enums.

**TASK-018: Create initial migration and seed script** - Created initial PostgreSQL migration (20260325114859_init) and seed script with 3 providers, 15 Romanian cities, 8 routes, 5 buses with seat grids, 15 schedules with stop times/segment pricing, and 9 demo accounts (bcryptjs cost 12). Added dotenv for prisma.config.ts env loading.

---

## Auth Implementation

**TASK-019: Create auth domain types** - Created auth.types.ts (RegisterData, LoginCredentials, AuthTokenPayload, TokenPair, ForgotPasswordData, ResetPasswordData, ChangePasswordData) and user.entity.ts (UserEntity, UserPreferences, UserUpdateData) matching OpenAPI spec schemas exactly. 21 tests passing.

**TASK-020: Create auth service with security features** - Created AuthService class with register, login, logout, refreshToken, forgotPassword, resetPassword, changePassword, generateTokens methods. Password strength validation (8+ chars, upper+lower+digit), account lockout (5 failures → 15min lock), SHA-256 hashed refresh/reset tokens, token rotation with reuse detection, timing-safe forgotPassword. Also created createLogger utility and added ACCOUNT_LOCKED/ACCOUNT_SUSPENDED/AUTH_INVALID_RESET_TOKEN error codes. 35 unit tests with mocked Prisma.

**TASK-021: Create auth plugin and role guards with account status checks** - Created auth.ts plugin (JWT validation, DB user status check: SUSPENDED→403, LOCKED→423, decorates request.user with Fastify type augmentation) and role-guard.ts (requireRole, requireProvider, requireDriver, requireAdmin factories). Zero `as any` casts. 28 unit tests covering all error scenarios.

**TASK-022: Create auth routes** - Created src/api/auth/schemas.ts (15 Zod schemas with .describe() matching OpenAPI spec exactly, strict parsing, password regex) and src/api/auth/routes.ts (all 9 endpoints: register, login, refresh, logout, forgot-password, reset-password, change-password, get me, update me). Added getProfile/updateProfile to AuthService. Registered auth plugin + routes in app.ts. 32 integration tests with Supertest covering all endpoints and error cases. 137 unit + 36 integration tests passing.

---

## Quality Gates

**TASK-023: Create CLAUDE.md for backend** - Created apps/api/CLAUDE.md with tech stack, quick start, layered architecture rules, API-first workflow, API conventions (envelope + RFC 9457 errors), route/service patterns, quality gate commands, test conventions, env vars table, and key patterns.

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
