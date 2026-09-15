# 10: Handle startup errors and local-data erasure

**What to build:** Load only trusted browser-local data and provide one blocking Retry or Erase path when IndexedDB cannot open, migrate, or validate.

**Blocked by:** 06: Create and validate the V1 database.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Startup opens and upgrades IndexedDB, validates core metadata, todos, and awards, rebuilds derived counters when safe, and then returns the projection.
- [x] Startup never returns a false empty level-0 result before opening and validation finish.
- [x] Database-open, migration, schema, rules, or unsafe-XP failure returns one local-data error category with no task text.
- [x] The failure path does not quarantine, repair, skip, export, salvage, or replace records and does not fall back to an in-memory list.
- [x] Retry repeats startup without changing data.
- [x] Erase opens one confirmation dialog and permanently recreates fresh browser-local state only after confirmation.
- [x] Normal erasure clears all stores atomically and then clears the composer draft; an unrecoverable open failure may use explicit confirmed database deletion.
- [x] Tests cover each failure class, Retry, cancelled erasure, successful erasure, transactional rollback, and proof that no automatic path deletes data.

## Comments

2026-09-15: Added strict startup preparation, one task-free local-data failure boundary, data-preserving Retry behavior, explicit confirmation guarding, atomic store erasure, composer-draft clearing, and confirmed database recreation for unrecoverable open failures. `npm run build` and all 66 current Playwright tests pass.
