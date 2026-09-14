# 04: Calculate progression, ranks, and capacity

**What to build:** Derive level, current-level progress, canonical rank, and Active Bay capacity from Lifetime XP without scanning level by level.

**Blocked by:** 01: Prove the toolchain and static shell.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] The production curve uses 10 base XP, the level-100 anchor, and 500-todo pacing and matches every reference threshold through level 1,000.
- [x] Level lookup uses exponential upper-bound discovery followed by binary search and clamps progress to the inclusive range 0 through 1.
- [x] Reject negative, fractional, non-finite, and unsafe integer inputs.
- [x] Ranks change every five levels, use all nine base ranks, and continue with the specified bijective-base-8 prestige atoms.
- [x] Canonical titles match the samples through Prime-Prime Marshal and remain complete in state and accessible output.
- [x] Active Bay capacity starts at 8, rises every five levels, caps at 16, and passes every boundary test through the cap.

## Comments

- 2026-09-14: Added logarithmic XP thresholds, exponential-bound and binary-search level lookup, current-level progress, canonical base and prestige ranks, and capped Active Bay capacity. `npm run typecheck`, `npm run build`, and all 29 current Playwright tests pass.
