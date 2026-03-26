# Phase 4: Production Hardening — Security, Observability, Performance

**Status**: Pending
**Dependencies**: Phase 3 (all endpoints implemented)
**Goal**: Harden the backend for production: security middleware, structured observability, performance optimizations, Docker setup, and comprehensive quality validation.

---

## Security

### TASK-001: Configure CORS properly
**Description:** Configure `@fastify/cors` in `app.ts` with environment-driven origin whitelist (CORS_ORIGIN env var, comma-separated). Restrict methods to used HTTP verbs only. Set credentials: true for cookie support. Different configs for dev (permissive) vs production (strict).

**Acceptance Criteria:**
- [x] CORS origin from CORS_ORIGIN env var
- [x] Dev mode allows localhost origins
- [x] Production mode restricts to configured origins
- [x] Credentials enabled
- [x] Preflight caching (maxAge: 86400)
- [x] Integration test verifying CORS headers
- [x] Typecheck passes

### TASK-002: Configure Helmet security headers
**Description:** Register `@fastify/helmet` with production-appropriate CSP, HSTS, X-Frame-Options, referrer policy. Disable in test environment.

**Acceptance Criteria:**
- [x] Helmet registered with strict defaults
- [x] CSP configured for API (no inline scripts needed)
- [x] HSTS enabled with 1 year max-age
- [x] X-Frame-Options: DENY
- [x] Typecheck passes

### TASK-003: Configure rate limiting
**Description:** Register `@fastify/rate-limit` with per-route configuration: auth endpoints (login/register): 10 req/min per IP. General API: 100 req/min per user. Search (public): 30 req/min per IP. Return 429 with RFC 9457 format and Retry-After header.

**Acceptance Criteria:**
- [x] Rate limiting on auth routes (10/min)
- [x] Rate limiting on general routes (100/min per user)
- [x] Rate limiting on public search (30/min per IP)
- [x] 429 response matches RFC 9457 ErrorResponse schema
- [x] Retry-After header included
- [x] Integration test for rate limit trigger
- [x] Typecheck passes

### TASK-004: Input sanitization and validation hardening
**Description:** Review all Zod schemas for: string max lengths (prevent payload bombs), number ranges, enum strictness. Add global request body size limit (1MB). Ensure all user-provided strings are trimmed. Add `x-request-id` header generation for request tracing.

**Acceptance Criteria:**
- [x] All string fields have maxLength in Zod schemas
- [x] All number fields have min/max bounds
- [x] Request body size limited to 1MB
- [x] Strings trimmed via Zod `.trim()` transform
- [x] x-request-id generated per request (UUID)
- [x] Typecheck passes

### TASK-005: Create audit logging service
**Description:** Create `src/application/services/audit.service.ts` with `AuditService`. Logs security-relevant events to the AuditLog table: LOGIN_SUCCESS, LOGIN_FAILURE, LOGIN_LOCKED, REGISTER, LOGOUT, PASSWORD_RESET_REQUEST, PASSWORD_RESET_COMPLETE, PASSWORD_CHANGE, ACCOUNT_SUSPENDED, ACCOUNT_LOCKED, BOOKING_CREATED, BOOKING_CANCELLED. Methods: `log(event)` — fire-and-forget (never block the request), `getByUser(userId, pagination)` — for admin viewing. Captures: userId, action, resource, resourceId, ipAddress (from request), userAgent (from request).

**Acceptance Criteria:**
- [x] All security events logged (login, logout, password changes, lockouts)
- [x] Booking events logged (create, cancel)
- [x] IP address and user agent captured from Fastify request
- [x] `log()` is fire-and-forget (errors caught, never blocks response)
- [x] `getByUser()` supports pagination for admin queries
- [x] Unit tests
- [x] JSDoc on all public methods
- [x] Typecheck passes

### TASK-006: Add audit logging hooks to existing services
**Description:** Integrate AuditService into: AuthService (login success/failure/lockout, register, logout, password reset/change), BookingService (create, cancel). Create a Fastify plugin `src/api/plugins/audit.ts` that decorates request with `request.audit(action, resource, resourceId?)` helper extracting IP + userAgent automatically.

**Acceptance Criteria:**
- [x] Auth events: LOGIN_SUCCESS, LOGIN_FAILURE, LOGIN_LOCKED, REGISTER, LOGOUT, PASSWORD_RESET_REQUEST, PASSWORD_RESET_COMPLETE, PASSWORD_CHANGE
- [x] Booking events: BOOKING_CREATED, BOOKING_CANCELLED
- [x] `request.audit()` helper available in all routes
- [x] IP address extracted from x-forwarded-for or socket
- [x] Integration tests verify audit log entries created
- [x] Typecheck passes

### TASK-007: Token cleanup and session management
**Description:** Create `src/jobs/token-cleanup.ts` with a function (invokable via npm script or cron) that: deletes expired refresh tokens, deletes expired/used password reset tokens, unlocks accounts past their lockout period (reset failedLoginAttempts, clear lockedUntil). Add `npm run jobs:cleanup-tokens` script. Add admin endpoint `DELETE /api/v1/admin/users/{id}/sessions` to revoke all refresh tokens for a user (force logout).

**Acceptance Criteria:**
- [x] Cleanup deletes expired refresh tokens (older than 7d)
- [x] Cleanup deletes used/expired password reset tokens (older than 24h)
- [x] Cleanup unlocks accounts past lockedUntil
- [x] `npm run jobs:cleanup-tokens` runs successfully
- [x] Admin can force-logout a user by revoking all their refresh tokens
- [x] Unit tests for cleanup logic
- [x] Typecheck passes

### TASK-008: Admin user management endpoints
**Description:** Add admin endpoints to OpenAPI spec and implement: `GET /api/v1/admin/users` (list all users, paginated, filterable by role/status), `PATCH /api/v1/admin/users/{id}/status` (suspend/unsuspend/unlock user), `GET /api/v1/admin/audit-logs` (view audit logs, paginated, filterable by userId/action/dateRange). All require ADMIN role.

**Acceptance Criteria:**
- [x] List users with pagination + role/status filters
- [x] Suspend user: sets status=SUSPENDED, revokes all refresh tokens
- [x] Unsuspend user: sets status=ACTIVE
- [x] Unlock user: sets status=ACTIVE, resets failedLoginAttempts, clears lockedUntil
- [x] Audit log viewer with filters
- [x] All responses match OpenAPI spec
- [x] Integration tests
- [x] Typecheck passes

---

## Observability

### TASK-009: Set up structured logging
**Description:** Create `src/infrastructure/observability/logger.ts` with `createLogger(name)` factory using Pino (Fastify's built-in logger). Configure: JSON format in production, pretty-print in dev. Log levels from LOG_LEVEL env var. Add request logging plugin with: method, url, statusCode, responseTime, requestId. Redact sensitive fields (password, token, authorization).

**Acceptance Criteria:**
- [x] `createLogger(name)` factory exported
- [x] JSON logs in production, pretty in dev
- [x] Request logging with timing
- [x] Sensitive fields redacted from logs
- [x] All existing services use `createLogger`
- [x] Typecheck passes
- [x] JSDoc on createLogger

### TASK-010: Add health check enhancements
**Description:** Enhance `GET /health` to include: database connectivity check (Prisma `$queryRaw`), memory usage, environment indicator. Add `GET /health/ready` (readiness probe for k8s) that checks DB connection. Add `GET /health/live` (liveness probe) that always returns 200.

**Acceptance Criteria:**
- [x] `/health` returns db status, memory, environment
- [x] `/health/ready` fails if DB unreachable
- [x] `/health/live` always returns 200
- [x] Integration tests
- [x] Typecheck passes

### TASK-011: Add request timing and metrics hooks
**Description:** Create `src/api/plugins/metrics.ts` Fastify plugin that logs: request count by route, response time percentiles (logged on each request), error rate by status code. Use Fastify onResponse hook to capture timing. Log summary stats every 60s in production.

**Acceptance Criteria:**
- [x] Request timing logged on every response
- [x] Error count tracked by status code
- [x] Summary stats logged periodically in production
- [x] Typecheck passes

---

## Performance

### TASK-012: Add pagination to all list endpoints
**Description:** Audit all list endpoints and ensure they use pagination from `shared/pagination.ts`. Default pageSize: 20, max: 100. Verify search endpoint limits results. Add `totalCount` to all paginated responses.

**Acceptance Criteria:**
- [x] All list endpoints paginated: routes, buses, drivers, schedules, bookings, admin/buses, driver/trips, delays
- [x] Default page=1, pageSize=20, max pageSize=100
- [x] Search results limited to 50 per page
- [x] All paginated responses include `meta: { total, page, pageSize, totalPages }`
- [x] Integration tests verify pagination

### TASK-013: Optimize database queries
**Description:** Review all Prisma queries for: N+1 issues (use `include` or `select` appropriately), unnecessary fields loaded (use `select` to limit), missing indexes. Add composite indexes where needed (e.g., BookingSeat schedule+trip+seat, Schedule route+status). Add `@index` pragmas to schema.prisma where query patterns warrant.

**Acceptance Criteria:**
- [x] All list queries use `select` to limit fields
- [x] Related data loaded with `include` (not separate queries)
- [x] Composite indexes added for common query patterns
- [x] Migration created for new indexes
- [x] No N+1 queries in search or list endpoints
- [x] Typecheck passes

### TASK-014: Add response caching headers
**Description:** Add appropriate Cache-Control headers: search results (public, max-age=30), trip details (public, max-age=10), bus templates (public, max-age=3600), tracking data (no-cache), user data (private, no-cache). Create a Fastify preHandler helper for setting cache headers.

**Acceptance Criteria:**
- [x] Cache headers set per route type
- [x] Public cacheable endpoints have appropriate max-age
- [x] Private/dynamic data has no-cache
- [x] Helper function for easy cache configuration per route
- [x] Typecheck passes

---

## Docker & Deployment

### TASK-015: Create Docker setup for backend
**Description:** Create `apps/api/Dockerfile` (multi-stage: install → generate Prisma → build → slim runner with node:20-alpine). Create `docker-compose.yml` at monorepo root with: PostgreSQL 16, API service (depends on postgres), volume for DB data. Add `.env.example` with all required env vars documented.

**Acceptance Criteria:**
- [x] Multi-stage Dockerfile (build + runtime stages)
- [x] Runtime image uses node:20-alpine (minimal)
- [x] `docker-compose.yml` with postgres + api services
- [x] `.env.example` documents all required variables
- [x] `docker compose up` starts both services
- [x] Health check in Docker compose
- [x] Typecheck passes

### TASK-016: Create database migration and seed scripts for Docker
**Description:** Add npm scripts: `db:migrate:deploy` (for production, uses `prisma migrate deploy`), `db:migrate:reset` (for dev, uses `prisma migrate reset --force`). Update seed script to be idempotent (upsert, not create). Add a `docker-entrypoint.sh` that runs migrations before starting the server.

**Acceptance Criteria:**
- [ ] `db:migrate:deploy` runs pending migrations
- [ ] `db:migrate:reset` resets and re-seeds
- [ ] Seed script is idempotent (safe to run multiple times)
- [ ] Docker entrypoint runs migrations automatically
- [ ] Typecheck passes

---

## API Spec Validation

### TASK-017: Add API spec conformance validation
**Description:** Create `npm run api:validate` script that: starts the test server, hits all spec-defined endpoints, validates response shapes against OpenAPI schemas using Ajv. This ensures the implementation matches the spec. Can also use `@fastify/swagger`'s built-in response validation in test mode.

**Acceptance Criteria:**
- [ ] Script validates all ~36 endpoints against OpenAPI spec
- [ ] Response schema mismatches reported with details
- [ ] Runs as part of CI/quality gates
- [ ] Typecheck passes

---

## Penetration Testing Hardening

### TASK-018: OWASP API — Ownership enforcement audit (BOLA/IDOR prevention)
**Description:** Audit ALL mutation endpoints for ownership enforcement. Every PROVIDER endpoint must verify `resource.providerId === request.user.providerId`. Every PASSENGER endpoint must verify `resource.userId === request.user.id`. Every DRIVER endpoint must verify schedule assignment. Create a shared middleware helper `verifyOwnership(resourceProviderId, requestProviderId)` that throws 404 (not 403, to prevent resource enumeration). Write integration tests that prove cross-tenant access is blocked.

**Acceptance Criteria:**
- [ ] Route DELETE/PUT: verifies `route.providerId === session.providerId`
- [ ] Bus DELETE/PUT: verifies `bus.providerId === session.providerId`
- [ ] Schedule CREATE: verifies referenced route AND bus belong to provider
- [ ] Schedule PUT/DELETE: verifies `schedule` ownership through route → provider chain
- [ ] Booking GET/DELETE: verifies `booking.userId === session.userId`
- [ ] Delay PUT: verifies delay's schedule belongs to provider
- [ ] Tracking POST (PROVIDER path): verifies `bus.providerId === session.providerId`
- [ ] Driver DELETE: verifies `driver.providerId === session.providerId`
- [ ] Admin seat toggle: requires ADMIN role (not just any provider)
- [ ] All ownership failures return 404 (not 403 — prevent resource enumeration)
- [ ] Integration tests: Provider A cannot access Provider B's resources
- [ ] Integration tests: Passenger A cannot see/cancel Passenger B's bookings
- [ ] Typecheck passes

### TASK-019: OWASP API — Mass assignment and over-posting prevention
**Description:** Audit ALL request body parsing. Every endpoint must use Zod `.strict()` mode to reject unknown fields. Specifically prevent: role escalation at registration (only PASSENGER and PROVIDER allowed, not ADMIN/DRIVER), price manipulation on bookings (server must compute totalPrice, never trust client), driverId injection on schedules (validate driver belongs to same provider). Create a shared Zod helper `strictParse(schema, body)` that rejects unknown properties and returns 400 with field-level errors.

**Acceptance Criteria:**
- [ ] All Zod schemas use `.strict()` — unknown fields rejected with 400
- [ ] Registration endpoint: role whitelist (PASSENGER, PROVIDER only)
- [ ] Booking creation: totalPrice computed server-side from segment pricing (never from request body)
- [ ] Schedule creation: driverId validated to belong to same provider
- [ ] `strictParse()` helper used in all routes
- [ ] Integration tests: extra fields in request body → 400
- [ ] Integration tests: role=ADMIN at registration → 400
- [ ] Integration tests: manipulated totalPrice ignored
- [ ] Typecheck passes

### TASK-020: OpenAPI spec — Add comprehensive limits and constraints
**Description:** Update `spec/openapi.yaml` to add explicit constraints on EVERY field:
- All strings: `maxLength` (name: 100, email: 254, password: 128, note: 1000, licensePlate: 20, stopName: 100, city: 100)
- All numbers: `minimum`/`maximum` (price: 0-99999, rows: 1-30, columns: 1-6, capacity: 1-200, latitude: -90/90, longitude: -180/180, offsetMinutes: 1-1440, page: 1-1000, pageSize: 1-100)
- All arrays: `minItems`/`maxItems` (seatLabels: 1-10, stops: 2-50, daysOfWeek: 1-7 items)
- All enums: exhaustive (no additionalProperties on objects)
- Request body: `maxLength` via server config (1MB)
- Password: `minLength: 8`, `pattern` for strength
- Email: `format: email`, `maxLength: 254`
- Dates: `format: date-time` or `format: date`

**Acceptance Criteria:**
- [ ] Every string field has maxLength
- [ ] Every number field has minimum and maximum
- [ ] Every array field has minItems and maxItems
- [ ] Every enum is exhaustive (no open-ended strings)
- [ ] Password field has minLength + pattern
- [ ] Email field has format + maxLength
- [ ] Coordinate fields bounded (-90/90 lat, -180/180 lng)
- [ ] Price fields bounded (0-99999)
- [ ] `spec:lint` passes
- [ ] All Zod schemas in BE updated to match these limits exactly

### TASK-021: XSS and injection prevention
**Description:** Even though Prisma prevents SQL injection and React auto-escapes JSX, add defense-in-depth: (1) Create a Fastify plugin `sanitize-input.ts` that strips HTML tags from all string inputs using a lightweight sanitizer (e.g., `xss` or `sanitize-html` library — allowlist approach, strip everything by default). (2) Add Content-Security-Policy header that blocks inline scripts. (3) Validate all URL fields (avatarUrl, provider logo) against an allowlist of URL schemes (only https:). (4) Ensure no endpoint returns user-controlled data in HTTP headers (header injection). (5) Add `X-Content-Type-Options: nosniff` to prevent MIME sniffing.

**Acceptance Criteria:**
- [ ] Input sanitizer strips HTML tags from all string fields
- [ ] CSP header blocks inline scripts: `default-src 'self'; script-src 'self'`
- [ ] URL fields validated (https: only, no javascript: or data: schemes)
- [ ] No user input reflected in response headers
- [ ] `X-Content-Type-Options: nosniff` on all responses
- [ ] Integration test: HTML in name field → stripped in response
- [ ] Integration test: javascript: URL in avatarUrl → rejected
- [ ] Typecheck passes

### TASK-022: JWT hardening and token security
**Description:** Harden JWT configuration: (1) Validate `iss` (issuer) and `aud` (audience) claims on every token verification. (2) Explicitly reject `alg: none` tokens. (3) Use RS256 (asymmetric) or ensure HS256 secret is ≥256 bits. (4) Set access token expiry to 15min (already done). (5) Add `jti` (JWT ID) claim for token tracking. (6) Validate token hasn't been revoked (check RefreshToken table). (7) Add `nbf` (not before) claim. (8) Ensure JWT_SECRET and JWT_REFRESH_SECRET are different values. (9) Add env validation that secrets are ≥32 characters.

**Acceptance Criteria:**
- [ ] JWT includes `iss`, `aud`, `jti`, `nbf` claims
- [ ] Token verification validates `iss` and `aud`
- [ ] `alg: none` explicitly rejected (jsonwebtoken library does this by default with algorithms option)
- [ ] Env validation: JWT_SECRET ≥ 32 chars, JWT_REFRESH_SECRET ≥ 32 chars, both different
- [ ] Refresh token revocation checked on every refresh
- [ ] Unit tests for token validation edge cases (expired, wrong audience, wrong issuer, revoked)
- [ ] Typecheck passes

### TASK-023: Account enumeration prevention
**Description:** Prevent attackers from discovering valid email addresses: (1) Registration: if email exists, return same 200 response as success (or use email verification flow). (2) Login: always run bcrypt.compare even when user not found (timing-safe). (3) Forgot-password: already returns 200 always (verify). (4) Rate limit all auth endpoints (already done in TASK-003). (5) Add constant-time string comparison for tokens where applicable.

**Acceptance Criteria:**
- [ ] Login: dummy bcrypt.compare when user not found (equalizes timing)
- [ ] Registration: returns generic success message (doesn't reveal if email exists)
- [ ] Forgot-password: always 200 regardless of email existence (already in spec)
- [ ] All token comparisons use constant-time comparison (crypto.timingSafeEqual)
- [ ] Integration tests verify identical response times for valid/invalid emails (within 100ms tolerance)
- [ ] Typecheck passes

### TASK-024: DoS and resource exhaustion prevention
**Description:** Prevent denial-of-service vectors: (1) Global request body size: 1MB (`fastify.bodyLimit`). (2) JSON depth limit: reject deeply nested payloads (max 5 levels via custom parser or Fastify's `bodyLimit`). (3) Prisma query timeouts: add `PrismaClient` with `timeout: 10000` for all queries. (4) Array field limits enforced in Zod (seats: max 200, stops: max 50, seatLabels: max 10). (5) Search endpoint: limit results to 50, add minimum query length for text search. (6) Pagination: enforce max pageSize=100 server-side (even if client sends pageSize=10000). (7) Slow request detection: log warning for requests >5s. (8) Concurrent booking limit: max 5 active bookings per user.

**Acceptance Criteria:**
- [ ] `fastify.bodyLimit = 1_048_576` (1MB)
- [ ] JSON nesting depth limited (reject >5 levels)
- [ ] Prisma client timeout configured (10s)
- [ ] All array fields have maxItems in Zod
- [ ] Search results limited to 50 per page
- [ ] Pagination enforces max pageSize=100 server-side
- [ ] Slow request warning logged (>5s)
- [ ] Max 5 active bookings per user enforced
- [ ] Integration test: oversized payload → 413
- [ ] Integration test: pageSize=10000 → clamped to 100
- [ ] Typecheck passes

### TASK-025: Security headers and CORS hardening
**Description:** Ensure all security headers are production-grade: (1) HSTS with 1y max-age, includeSubDomains, preload. (2) CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. (3) X-Frame-Options: DENY. (4) X-Content-Type-Options: nosniff. (5) Referrer-Policy: strict-origin-when-cross-origin. (6) Permissions-Policy: `camera=(), microphone=(), geolocation=(self)`. (7) Remove `X-Powered-By` header. (8) CORS: strict origin whitelist from env, no wildcard with credentials, expose only necessary headers. Verify with curl that no sensitive headers leak.

**Acceptance Criteria:**
- [ ] All 7 security headers set
- [ ] `X-Powered-By` removed
- [ ] CORS origin whitelist from CORS_ORIGIN env (no wildcard)
- [ ] CORS: credentials true, methods restricted, maxAge: 86400
- [ ] Integration test: verify all headers present in response
- [ ] Integration test: CORS preflight returns correct headers
- [ ] Integration test: cross-origin request from unlisted origin → blocked
- [ ] Typecheck passes

### TASK-026: Secrets and information disclosure prevention
**Description:** (1) Ensure no secrets in git history: add `gitleaks` as devDep, create `npm run security:secrets` script. (2) Error responses never include stack traces, Prisma error details, or SQL in production (`NODE_ENV=production`). (3) Swagger UI disabled in production (only dev/staging). (4) Health endpoint doesn't expose version numbers or internal IPs. (5) Remove seed demo credentials display from any public-facing code. (6) Add `.env.example` with all vars documented but no real values. (7) Verify `npm audit --audit-level=high` passes. (8) Add `npm run security:audit` script that runs both gitleaks + npm audit.

**Acceptance Criteria:**
- [ ] `gitleaks` installed and `npm run security:secrets` script works
- [ ] `npm run security:audit` runs gitleaks + npm audit
- [ ] Error handler: Prisma errors → generic 500 in production (no detail leak)
- [ ] Swagger UI disabled when NODE_ENV=production
- [ ] Health endpoint: no version, no internal IPs
- [ ] `.env.example` complete with comments, no real secrets
- [ ] `npm audit --audit-level=high` passes (zero high/critical)
- [ ] Integration test: trigger Prisma error → verify no detail in response body
- [ ] Typecheck passes

---

## Final Quality Gates

### TASK-027: Comprehensive quality and security audit
**Description:** Run ALL quality gates and fix every issue:

**Code Quality:**
1. `npm run typecheck` — zero errors
2. `npm run lint` — zero errors (warnings reviewed)
3. `npm run format:check` — passes
4. `npm run test` — all unit tests pass
5. `npm run test:integration` — all integration tests pass
6. `npm run test:coverage` — ≥ 85%
7. `npm run build` — succeeds

**API Contract:**
8. `npm run spec:lint` — OpenAPI spec validates
9. `npm run api:validate` — all responses match spec schemas
10. All string fields have maxLength in spec AND Zod
11. All number fields have min/max in spec AND Zod
12. All arrays have minItems/maxItems in spec AND Zod
13. All error responses follow RFC 9457

**Security:**
14. `npm run security:audit` — gitleaks clean + npm audit clean
15. Zero `any` in production code
16. JSDoc on ALL exported functions/classes/methods
17. No hardcoded secrets in code
18. No console.log in production code (use logger)
19. All IDOR/ownership tests pass
20. Account enumeration tests pass (timing-safe)
21. Rate limiting active on all auth endpoints
22. Security headers verified (HSTS, CSP, X-Frame-Options, etc.)
23. CORS configured with strict origin whitelist

**Acceptance Criteria:**
- [ ] All 23 checks pass
- [ ] Coverage report generated and reviewed
- [ ] Security audit report clean
- [ ] Backend is production-ready and pentest-hardened
