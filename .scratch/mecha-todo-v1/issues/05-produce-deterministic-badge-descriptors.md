# 05: Produce deterministic badge descriptors

**What to build:** Convert a level and canonical rank into a stable renderer-independent pixel-badge description.

**Blocked by:** 04: Calculate progression, ranks, and capacity.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Each base rank selects a distinct documented silhouette and level modulo five adds zero through four pips.
- [x] Prestige keeps the Marshal silhouette and maps its first atoms to stable visible modifiers.
- [x] Fold remaining prestige atoms into a documented stable hash without randomness or an expanding view box.
- [x] Keep the descriptor free of Solid, DOM, IndexedDB, and current-time dependencies.
- [x] Tests cover every base rank, all pip counts, representative repeated prestige atoms, a long title, and repeatability.

## Comments

- 2026-09-14: Added the fixed-view-box badge descriptor, nine silhouette IDs, eight prestige modifier IDs, pip counts, and documented 32-bit FNV-1a folding for later prestige atoms. `npm run typecheck`, `npm run build`, and all 36 current Playwright tests pass.
