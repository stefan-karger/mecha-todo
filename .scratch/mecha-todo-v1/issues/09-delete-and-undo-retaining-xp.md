# 09: Delete and undo while retaining XP

**What to build:** Physically delete a todo while retaining any immutable award, then allow one guarded five-second in-memory Undo.

**Blocked by:** 07: Query, add, and edit ordered todos; 08: Complete and reopen todos atomically.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Delete removes only the todo and never changes its completion award, Lifetime XP, daily ordinal history, or LINK history.
- [x] Deleting an Active todo fills available capacity from the oldest Standby records before commit.
- [x] Return the deleted record to the initiating page without writing a soft delete or persisted undo queue.
- [x] Restore succeeds only while the ID remains absent and restores the former status and ordering without changing the award.
- [x] Restore may leave Active above capacity and does not reverse promotions made by the deletion.
- [x] After five seconds, reload, page close, or successful Undo, the initiating page drops its Undo copy.
- [x] Tests cover every status, rewarded and never-rewarded deletion, promotion, successful and rejected Undo, expiry, reload, and unchanged XP.

## Comments

2026-09-14: Added physical todo deletion, award-preserving restore, ordered Active replacement, and a page-memory Undo controller with a 5,000 ms lifetime. `npm run build` and all 61 current Playwright tests pass.
