# 02: Enforce the todo text contract

**What to build:** Provide one pure todo-text operation that normalizes and accepts valid one-line text and reports invalid input without truncation.

**Blocked by:** 01: Prove the toolchain and static shell.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Replace each run of JavaScript Unicode whitespace with one ASCII space and trim leading and trailing whitespace.
- [x] Preserve casing and every other character without applying Unicode normalization.
- [x] Count Unicode code points and accept lengths 1 through 280 while rejecting 0 and 281 with specific results.
- [x] Accept duplicate normalized text.
- [x] Produce new opaque todo IDs with <code>crypto.randomUUID()</code>.
- [x] Direct Playwright-runner tests cover multiline paste, unusual whitespace, duplicates, and the 0, 1, 280, and 281 boundaries.

## Comments

- 2026-09-14: Added the pure todo-text normalizer and validator, specific empty and overlong results, and a separate UUID factory. `npm run typecheck`, `npm run build`, and all nine current Playwright tests pass.
