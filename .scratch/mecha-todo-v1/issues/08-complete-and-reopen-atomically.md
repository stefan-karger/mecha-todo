# 08: Complete and reopen todos atomically

**What to build:** Complete, reopen, and re-complete todos in atomic transactions that award XP once and preserve ordering and Active Bay rules.

**Blocked by:** 03: Calculate V1 completion awards; 04: Calculate progression, ranks, and capacity; 06: Create and validate the V1 database; 07: Query, add, and edit ordered todos.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] First completion reads current state inside its transaction and creates one immutable award before committing the Completed todo.
- [x] The transaction derives ordinal and LINK eligibility through award indexes and includes anonymous awards left by deleted todos.
- [x] New Lifetime XP determines capacity before the transaction fills every available slot from oldest Standby.
- [x] Reopen always returns a Completed todo to Active, retains its award and creation order, and may leave Active above capacity.
- [x] Re-completion adds no XP, allocates a new completion order, returns already credited, and runs normal Standby promotion.
- [x] Same-todo races create one award; different-todo ordinal contention retries and recomputes rather than returning already credited.
- [x] A missing target returns the reload instruction.
- [x] Tests cover all reward milestones, over-capacity reopen, deleted-award history, multi-slot promotion, and both race types.

## Comments

- 2026-09-14: Added explicit complete and reopen repository mutations with atomic award creation, indexed ordinal and LINK lookup, completion ordering, capacity recalculation, ordered Standby promotion, same-todo idempotence, and constraint retries. `npm run build` and all 55 current Playwright tests pass.
