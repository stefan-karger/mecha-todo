# 03: Calculate V1 completion awards

**What to build:** Calculate one immutable first-completion award from an injected local calendar and existing awards, including base XP, daily ordinal, LINK, and milestone-only COMBO.

**Blocked by:** 01: Prove the toolchain and static shell.

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Rules version 1 uses 10 base XP, 5 LINK XP, and COMBO bonuses of 2, 4, 6, and 8 only at ordinals 5, 10, 15, and 20.
- [x] Derive day keys from local calendar parts and find yesterday with calendar arithmetic rather than UTC slicing or elapsed hours.
- [x] Today's first award receives LINK only when the preceding local day contains an award.
- [x] LINK and COMBO cannot coexist under rules version 1, and ordinals above 20 receive only base XP.
- [x] Keep historical day keys unchanged across later clock and timezone changes.
- [x] Deterministic tests cover the required ordinals plus month, year, leap-day, daylight-saving, and no-yesterday cases.

## Comments

- 2026-09-14: Added frozen reward rules V1, local calendar day-key arithmetic, and immutable first-completion award calculation. `npm run typecheck`, `npm run build`, and all 19 current Playwright tests pass.
