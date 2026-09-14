# 06: Create and validate the V1 database

**What to build:** Open a fresh browser-local IndexedDB database with the complete V1 schema, strict record validation, and safe version-change handling.

**Blocked by:** 02: Enforce the todo text contract; 03: Calculate V1 completion awards; 04: Calculate progression, ranks, and capacity.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Database version 1 creates exactly the <code>todos</code>, <code>completionAwards</code>, and <code>meta</code> stores.
- [x] Todo and award indexes provide status ordering, globally unique creation and non-null completion orders, award-day lookup, and unique daily ordinals.
- [x] Valibot schemas enforce todo status relationships, safe ordering values, named meta records, immutable award fields, and supported rules.
- [x] The schema contains no day store, soft deletes, recovery snapshots, Quarantine, client identity, record revisions, sync log, or server model.
- [x] Version changes use an ordered old-version switch and abort on failure without automatically deleting or replacing the database.
- [x] An older connection closes on <code>versionchange</code>, and a blocked upgrade returns a retryable outcome.
- [x] Tests verify a fresh database, every store and index, validation results, a blocked upgrade, and migration rollback.

## Comments

- 2026-09-14: Added the typed `idb` schema, ordered V1 migration, initial metadata, retryable open outcomes, strict Valibot record and cross-record validation, and real-Chrome database tests. `npm run build` and all 46 current Playwright tests pass.
