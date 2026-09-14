# 07: Query, add, and edit ordered todos

**What to build:** Provide repository operations for projections, paging, addition, and last-write-wins editing while preserving authoritative ordering and capacity placement.

**Blocked by:** 02: Enforce the todo text contract; 04: Calculate progression, ranks, and capacity; 06: Create and validate the V1 database.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Components obtain projections and invoke mutations through one typed repository and never access IndexedDB directly.
- [x] Add validates text before its transaction, allocates creation order atomically, and selects Active or Standby from current capacity.
- [x] Active and Standby query oldest first, Completed queries newest completion first, and IDs break remaining ties.
- [x] Standby and Completed queries load 20 records at a time without reading the full history.
- [x] Edit changes only normalized text and its updated timestamp and uses last successful write wins.
- [x] A missing target returns <code>List changed in another tab. Reload to continue.</code> instead of recreating stale data.
- [x] Tests prove reload persistence, clock-independent ordering, capacity-aware placement, paging, validation without writes, concurrent edits, and missing-target behavior.

## Comments

- 2026-09-14: Added the typed IndexedDB repository, startup projection, metadata rebuild, atomic add and edit mutations, compound-index ordering, and 20-record cursor paging. `npm run build` and all 50 current Playwright tests pass.
