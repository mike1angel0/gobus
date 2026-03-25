# Doubts & Decisions Log

Document implementation uncertainties, options considered, and final decisions here.

---

## Login/ChangePassword verification password fields — no `pattern` constraint

**Doubt:** Validation rejection flagged that `LoginRequest.password` and `ChangePasswordRequest.currentPassword` lack the complexity `pattern` that `RegisterRequest.password` and `newPassword` fields have.

**Options:**
1. Add pattern to verification fields (strict)
2. Leave verification fields without pattern (pragmatic)

**Decision:** Option 2 — intentionally omitted. Verification fields (`LoginRequest.password`, `ChangePasswordRequest.currentPassword`) accept any password the user provides to verify against the stored hash. Adding a complexity pattern would reject valid legacy passwords or passwords set before the policy was enforced. Only fields that *set* a new password (`RegisterRequest.password`, `ResetPasswordRequest.newPassword`, `ChangePasswordRequest.newPassword`) enforce the complexity pattern. This follows common industry practice (e.g., bcrypt verification is the real check, not input format validation).
