# Doubts & Decisions

## TASK-014: User deletion strategy

**Doubt**: Soft-delete (add `deletedAt` column) vs archive-and-cascade?

**Decision**: Soft-delete with `deletedAt DateTime?` column on User model.

**Why**:
- Conventional, widely-understood pattern
- Preserves referential integrity — no need for archive tables or cascade rewrites
- Easy to implement: add `deletedAt: null` filter to queries
- Reversible: admin can "undelete" by clearing `deletedAt`
- The email unique constraint stays intact on soft-deleted users, preventing re-registration abuse
- Auth plugin treats soft-deleted users as "not found" (401), preventing account enumeration
