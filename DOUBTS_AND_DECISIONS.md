# Doubts & Decisions Log

Document implementation uncertainties, options considered, and final decisions here.

---

## Login/ChangePassword verification password fields — no `pattern` constraint

**Doubt:** Validation rejection flagged that `LoginRequest.password` and `ChangePasswordRequest.currentPassword` lack the complexity `pattern` that `RegisterRequest.password` and `newPassword` fields have.

**Options:**
1. Add pattern to verification fields (strict)
2. Leave verification fields without pattern (pragmatic)

**Decision:** Option 2 — intentionally omitted. Verification fields (`LoginRequest.password`, `ChangePasswordRequest.currentPassword`) accept any password the user provides to verify against the stored hash. Adding a complexity pattern would reject valid legacy passwords or passwords set before the policy was enforced. Only fields that *set* a new password (`RegisterRequest.password`, `ResetPasswordRequest.newPassword`, `ChangePasswordRequest.newPassword`) enforce the complexity pattern. This follows common industry practice (e.g., bcrypt verification is the real check, not input format validation).

---

## TASK-009: DriverTripDetail — PRD vs OpenAPI spec mismatch

**Doubt:** PRD acceptance criteria says "Detail includes booking count, passenger list, tracking status, active delay", but the OpenAPI spec `DriverTripDetail` schema only includes `passengerCount`, `totalSeats`, `stops`, and basic schedule fields — no passenger list, tracking status, or active delay fields.

**Options:**
1. Extend the spec and implementation to include passenger list, tracking, and delays
2. Follow the OpenAPI spec as-is (source of truth per CLAUDE.md)

**Decision:** Option 2 — the OpenAPI spec is the single source of truth. The PRD description is aspirational but the actual contract (spec) has the final say. If FE needs these fields, they can be added in a future iteration by extending the spec first.
