# MECHA//TODO rank and designation implementation plan

**Status:** Approved design. Implementation pending.

**Decision date:** 2026-09-17

## Authority

This document is the authoritative specification for the rank, designation, and badge upgrade.

[`MECHA_TODO_RANK_DESIGNATION_IDEA.md`](./MECHA_TODO_RANK_DESIGNATION_IDEA.md) remains in the repository as the original design input. It is a legacy document and must not guide implementation. Where that document and this plan conflict, this plan takes precedence.

The current application still implements the old V1 prestige-rank system. Until this plan is implemented, `CONTEXT.md` describes the running application. The implementation must update `CONTEXT.md`, README, and the release checklist in the same change that replaces the old behavior.

This plan is ready to be split into local Markdown tickets under `.scratch/`. It does not create those tickets and does not authorize implementation by itself.

## Outcome

Replace the unbounded procedural prestige-title system with a finite classification system:

```text
numeric level
base rank
optional Marshal designation
```

Named and visual progression ends at:

```text
LV 300
MARSHAL // ZULU
```

After LV 300, only the numeric level changes. The rank, designation, and badge remain `MARSHAL // ZULU` permanently.

The system is a fictional operator classification that uses familiar military terms. It is not intended to reproduce a real military hierarchy.

## Scope

The implementation includes:

- replacing `Trooper` with `Specialist`;
- replacing procedural prestige atoms with 26 fixed Marshal designations;
- separating rank and designation in the domain model;
- replacing the prestige badge modifiers with cumulative Marshal segments;
- updating the HUD, Progression details, promotion feedback, accessible names, and responsive behavior;
- adding the next named milestone to Progression details;
- adding a short promotion-only badge activation;
- expanding domain, renderer, visual, responsive, and accessibility tests;
- retaining a temporary badge review page until user approval;
- removing the review route after approval while keeping a test-only fixture;
- updating binding domain documentation and release evidence when the implementation lands.

## Non-goals

The implementation must not:

- change the XP curve;
- change Base XP, LINK, or COMBO;
- add task difficulty or variable task rewards;
- add anti-cheat or attempt to detect trivial todos;
- change Active Capacity rules;
- persist rank, designation, pips, badge state, or a taxonomy version;
- add ranks, designations, badge upgrades, colors, frames, stars, or other prestige markers after ZULU;
- add a full progression tree to Settings;
- add gradients, glow, blur, soft shadows, or ambient badge animation;
- add a generic theme system;
- reproduce a real national insignia or protected emblem;
- create implementation tickets during the design-plan step.

## Existing facts that must remain true

- Completion awards remain the source of truth for Lifetime XP.
- A todo can earn XP only on its first completion.
- Level remains derived from Lifetime XP.
- Active Capacity remains derived from level and reaches its existing cap at LV 40.
- Rank, designation, pips, and badge state remain derived values.
- IndexedDB continues to store only todos, completion awards, and metadata.
- No stored rank strings or prestige atoms exist, so no IndexedDB data migration is required.
- Existing local data is reclassified on the next load after the new mapping ships.
- The database version remains `1`. This feature does not change the schema.
- Stored award `rulesVersion` remains `1`.

## Final progression rules

### Levels

The product has no authored level cap. Implementation remains bounded by the existing nonnegative safe-integer model. No `BigInt` migration is part of this work.

Compact level codes use at least three digits and no grouping:

```text
LV 000
LV 042
LV 300
LV 934
LV 1000000
```

Progression details and accessible labels use locale-aware number formatting.

### Base ranks

Cadet through General last five levels each. Plain Marshal is an intentional ten-level transition state.

| Levels | Rank | Designation |
|---|---|---|
| 000 through 004 | Cadet | None |
| 005 through 009 | Specialist | None |
| 010 through 014 | Sergeant | None |
| 015 through 019 | Lieutenant | None |
| 020 through 024 | Captain | None |
| 025 through 029 | Major | None |
| 030 through 034 | Colonel | None |
| 035 through 039 | General | None |
| 040 through 049 | Marshal | None |

The phrase "rank changes every five levels" must not appear as a general rule. The precise rule is:

> Base rank changes every five levels from Cadet through General. Marshal begins at LV 40 and remains the permanent rank.

### Marshal designations

Designations are an ordered fictional Marshal classification based on the full NATO spelling alphabet. They do not claim to represent a real NATO hierarchy.

Use the official spellings. The array order is canonical and must not be produced by lexical sorting.

| Index | Levels | Designation | Visible identity |
|---:|---|---|---|
| 0 | 050 through 059 | Alfa | `MARSHAL // ALFA` |
| 1 | 060 through 069 | Bravo | `MARSHAL // BRAVO` |
| 2 | 070 through 079 | Charlie | `MARSHAL // CHARLIE` |
| 3 | 080 through 089 | Delta | `MARSHAL // DELTA` |
| 4 | 090 through 099 | Echo | `MARSHAL // ECHO` |
| 5 | 100 through 109 | Foxtrot | `MARSHAL // FOXTROT` |
| 6 | 110 through 119 | Golf | `MARSHAL // GOLF` |
| 7 | 120 through 129 | Hotel | `MARSHAL // HOTEL` |
| 8 | 130 through 139 | India | `MARSHAL // INDIA` |
| 9 | 140 through 149 | Juliett | `MARSHAL // JULIETT` |
| 10 | 150 through 159 | Kilo | `MARSHAL // KILO` |
| 11 | 160 through 169 | Lima | `MARSHAL // LIMA` |
| 12 | 170 through 179 | Mike | `MARSHAL // MIKE` |
| 13 | 180 through 189 | November | `MARSHAL // NOVEMBER` |
| 14 | 190 through 199 | Oscar | `MARSHAL // OSCAR` |
| 15 | 200 through 209 | Papa | `MARSHAL // PAPA` |
| 16 | 210 through 219 | Quebec | `MARSHAL // QUEBEC` |
| 17 | 220 through 229 | Romeo | `MARSHAL // ROMEO` |
| 18 | 230 through 239 | Sierra | `MARSHAL // SIERRA` |
| 19 | 240 through 249 | Tango | `MARSHAL // TANGO` |
| 20 | 250 through 259 | Uniform | `MARSHAL // UNIFORM` |
| 21 | 260 through 269 | Victor | `MARSHAL // VICTOR` |
| 22 | 270 through 279 | Whiskey | `MARSHAL // WHISKEY` |
| 23 | 280 through 289 | X-ray | `MARSHAL // X-RAY` |
| 24 | 290 through 299 | Yankee | `MARSHAL // YANKEE` |
| 25 | 300 and above | Zulu | `MARSHAL // ZULU` |

This produces 35 named identities: nine base-rank states, including plain Marshal, and 26 designated Marshal states.

### Pacing

The current curve places LV 300 at exactly 22,249 Lifetime XP.

- Without bonuses, reaching LV 300 requires 2,225 completed todos.
- At five completed todos on five active days per week, it takes about 1,990 todos and 1.52 calendar years.
- Daily patterns with LINK and COMBO produce different counts. The phrase "about 2,000 todos" is a usage estimate, not a curve invariant.
- Only LINK and COMBO exist. Documentation must not refer to unspecified existing XP modifiers.

Ten levels per designation is final. Five levels would end named progression too early. Fifteen or twenty levels would miss the selected pacing target.

## Domain and configuration design

### Separate rule concerns

The implementation must separate these concerns even when they currently share numeric values:

1. Award rules define Base XP, LINK, COMBO, and the stored award `rulesVersion`.
2. The level curve maps Lifetime XP to level.
3. The progression taxonomy maps level to rank and designation.
4. Capacity rules map level to Active Capacity.

`rulesVersion` must mean the immutable calculation rules used by a completion award. It must not version display taxonomy.

Remove `levelsPerRank` from the reward-rule object. Introduce separately named progression constants:

```ts
export const LEVELS_PER_BASE_RANK = 5;
export const MARSHAL_LEVEL = 40;
export const FIRST_DESIGNATION_LEVEL = 50;
export const LEVELS_PER_DESIGNATION = 10;
export const FINAL_DESIGNATION_LEVEL = 300;
```

Do not reuse the base-rank interval as the Active Capacity interval. Capacity owns its own constant or local rule.

### Canonical values

Use readonly tuples so order and string-literal types come from one source:

```ts
export const BASE_RANKS = [
  "Cadet",
  "Specialist",
  "Sergeant",
  "Lieutenant",
  "Captain",
  "Major",
  "Colonel",
  "General",
  "Marshal",
] as const;

export const DESIGNATIONS = [
  "Alfa",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
  "India",
  "Juliett",
  "Kilo",
  "Lima",
  "Mike",
  "November",
  "Oscar",
  "Papa",
  "Quebec",
  "Romeo",
  "Sierra",
  "Tango",
  "Uniform",
  "Victor",
  "Whiskey",
  "X-ray",
  "Yankee",
  "Zulu",
] as const;
```

Domain values use readable casing. CSS controls visible uppercase presentation.

Do not use TypeScript enums. Do not store combined strings such as `"Bravo Marshal"` or `"Marshal // Bravo"`.

### Progression identity

Replace the old string-only `rankForLevel()` source of truth with one structured API:

```ts
type NonMarshalRank = Exclude<BaseRank, "Marshal">;

type ProgressionIdentity =
  | Readonly<{
      rank: NonMarshalRank;
      designation: null;
    }>
  | Readonly<{
      rank: "Marshal";
      designation: Designation | null;
    }>;

function progressionIdentityForLevel(level: number): ProgressionIdentity;
```

The type must make non-Marshal designations unrepresentable. The function must validate level with the existing safe-integer guard.

The UI, repository view state, promotion feedback, milestone calculation, and badge descriptor must consume this structured result. They must not recalculate indices or parse display strings.

A temporary compatibility wrapper may exist while tickets are in progress, but the final implementation must have one source of truth.

### Next named milestone

Provide a derived API:

```ts
type NamedMilestone =
  | Readonly<{ kind: "rank"; rank: BaseRank; level: number }>
  | Readonly<{ kind: "designation"; designation: Designation; level: number }>;

function nextNamedMilestoneForLevel(level: number): NamedMilestone | null;
```

Behavior:

- Cadet through General return the next base rank and its first level.
- Plain Marshal returns Alfa at LV 50.
- Alfa through Yankee return the next designation and its first level.
- Zulu returns `null` at every level.

## Badge design

### Base-rank silhouettes

Use one handcrafted silhouette for each base rank:

| Rank | Silhouette direction |
|---|---|
| Cadet | Basic chevron |
| Specialist | Double chevron |
| Sergeant | Stepped chevron |
| Lieutenant | Diamond |
| Captain | Double diamond |
| Major | Winged diamond |
| Colonel | Shield with bars |
| General | Star with wings |
| Marshal | Heavy crest |

The first three form a chevron family. The next three form a diamond family. The final three form a command family. The shapes must look related without directly copying a real service's insignia.

Current paths are starting material, not protected output. The old Trooper geometry may inform Specialist, but the final family requires visual review as a whole.

### Pips

Cadet through General show progress within their five-level bands:

| Position in rank band | Pips |
|---:|---:|
| First level | 0 |
| Second level | 1 |
| Third level | 2 |
| Fourth level | 3 |
| Fifth level | 4 |

Plain Marshal and every Marshal designation show no pips. The descriptor type should omit pips for Marshal instead of representing their absence as a repeating `level % 5` value.

### Canonical geometry

- Keep one canonical `0 0 32 32` coordinate system.
- Use the same geometry at every rendered size.
- Optimize first for 44 and 48 CSS pixels.
- Use 96 and 112 pixels for the detail view.
- Treat 24 and 32 pixels as robustness checks.
- Do not require meaningful recognition at 16 pixels.
- Do not create compact and large SVG families.

The current Marshal silhouette occupies nearly the full 32-unit width. Redraw it with reserved interior and perimeter zones before adding designation fragments.

### Marshal designation fragments

Use one handcrafted Marshal base plus fixed authored fragments. Do not generate SVG paths procedurally.

| Designations | Phase | Steps |
|---|---|---:|
| Alfa through Echo | Core activation | 1 through 5 |
| Foxtrot through Juliett | Edge activation | 1 through 5 |
| Kilo through Oscar | Secondary layer | 1 through 5 |
| Papa through Tango | Outer frame | 1 through 5 |
| Uniform through Yankee | Energy nodes | 1 through 5 |
| Zulu | Final center seal | Final state |

Progression is strictly cumulative:

- Foxtrot retains the complete Echo core and adds edge step 1.
- Kilo retains complete core and edge phases and adds secondary-layer step 1.
- Papa retains every earlier phase and adds outer-frame step 1.
- Uniform retains every earlier phase and adds energy-node step 1.
- Yankee has all five phases fully active.
- Zulu retains all Yankee geometry and adds one unique center seal.

Every designation must produce distinct SVG geometry. At 44 and 48 pixels, the five phases and Zulu must be visually distinguishable. Exact designation recognition at that size is not required because adjacent text is authoritative.

Do not add an A through Z glyph.

### Badge descriptor

Expose one badge descriptor function:

```ts
function badgeDescriptorForLevel(level: number): BadgeDescriptor;
```

Use a discriminated union so base badges, plain Marshal, phased Marshal, and Zulu cannot be confused. The phased descriptor should expose active segment counts from 0 through 5 for:

- core;
- edge;
- secondary layer;
- outer frame;
- energy nodes.

Zulu also exposes `finalSeal: true`. The renderer receives resolved fragment state. It must not know how levels map to designations.

Use zero-based `designationIndex` values from 0 through 25 if the index is exposed internally. User-facing phase steps are one-based values from 1 through 5.

### SVG renderer

The renderer composes fixed `<path>`, `<polygon>`, and `<rect>` fragments.

Requirements:

- deterministic output;
- `currentColor` for normal theming;
- `shape-rendering="crispEdges"` unless visual review proves a specific element needs another setting;
- no random values;
- no prestige hash;
- no dynamic path generation;
- no gradients, masks, clip paths, filters, blur, glow, or soft shadows;
- no SVG IDs that can collide across multiple inline instances;
- no user-controlled SVG markup;
- no requirement to preserve the current `innerHTML` string renderer.

Use the current primary token for the normal badge and the system `Highlight` color in forced-colors mode. Do not introduce phase colors or a special Zulu color.

## Presentation and interaction

### Visible identity

The visible separator is always `//`:

```text
MARSHAL // BRAVO
```

The separator is presentation only. It is not part of either domain value.

Screenreader text must say:

```text
Marshal, designation Bravo
```

It must not announce "slash slash."

### HUD layout

Allow responsive layout without shrinking the identity text.

Wide form:

```text
LV 067 · MARSHAL // BRAVO
```

Narrow form:

```text
LV 067
MARSHAL // BRAVO
```

Level, rank, and designation must remain separate markup values so CSS can change layout without parsing a combined string.

Use `MARSHAL // NOVEMBER` as the longest real identity in width and overflow tests.

### Progression details

Show the current identity and exactly one future named milestone.

Before Marshal:

```text
Rank              Captain
Next rank         Major · LV 025
```

Plain Marshal:

```text
Rank              Marshal
Designation       —
Next designation  Alfa · LV 050
```

Designated Marshal:

```text
Rank              Marshal
Designation       Bravo
Next designation  Charlie · LV 070
```

Zulu:

```text
Rank              Marshal
Designation       Zulu
Named progression Final
```

Do not show the full rank and designation table in Settings.

### Promotion feedback

Treat a new designation as a first-class named advancement.

Feedback priority is:

1. new base rank;
2. new designation;
3. ordinary level increase.

Examples:

```text
RANK MARSHAL
DESIGNATION // ALFA
LEVEL 51
```

Feedback appears only after the completion transaction commits, as it does today.

### Promotion animation

Run one short badge activation when a committed completion unlocks a new base rank or designation.

Requirements:

- 200 through 300 milliseconds;
- hard, stepped activation rather than a soft transition;
- no glow, blur, continuous pulse, or layout movement;
- no animation for ordinary level increases;
- no replay on startup, reload, dialog opening, or passive state refresh;
- no animation when `prefers-reduced-motion: reduce` is active.

## Accessibility contract

- The badge and its SVG remain decorative and `aria-hidden` in product UI.
- Every product badge has adjacent visible identity text.
- Visible text is authoritative for the exact designation.
- No information relies on color, opacity, or animation alone.
- The five phases and Zulu remain structurally distinct in grayscale and forced colors.
- Focus behavior and the 44 by 44 CSS-pixel minimum target remain unchanged.
- HUD and Progression details support 200 percent text zoom without horizontal overflow.
- Promotion feedback remains in the existing polite live region.
- Reduced-motion behavior is tested, not inferred from CSS inspection alone.

## Persistence and compatibility

No database migration is required.

- Do not add rank, designation, or badge fields to IndexedDB.
- Do not increment the database version for this feature.
- Do not rewrite completion awards.
- Do not change existing award totals.
- Keep stored award `rulesVersion: 1`.
- Rebuild the displayed identity from existing Lifetime XP on load.
- Accept the pre-release reclassification of all existing local development data.

The source migration removes `atom` and procedural-prestige terminology from active code, styles, tests, snapshots, and current documentation. The word may remain only in the preserved legacy Idea document or historical version-control data.

## Edge cases and invariants

The final implementation must cover these cases explicitly:

- LV 0 is `Cadet` with zero pips and displays as `LV 000`.
- LV 39 is `General` with four pips.
- LV 40 is plain `Marshal` with no pips.
- LV 49 remains plain `Marshal` with no pips.
- LV 50 is `Marshal // Alfa` with core step 1.
- LV 59 remains Alfa.
- LV 60 is Bravo with core step 2.
- LV 99 is Echo with the full core.
- LV 100 is Foxtrot with the full core and edge step 1.
- LV 139 is India with edge step 4.
- LV 140 is Juliett with the full edge phase.
- LV 149 remains Juliett.
- LV 150 is Kilo with secondary-layer step 1.
- LV 199 is Oscar with the full secondary layer.
- LV 200 is Papa with outer-frame step 1.
- LV 249 is Tango with the full outer frame.
- LV 250 is Uniform with energy-node step 1.
- LV 289 is X-ray with energy-node step 4.
- LV 290 is Yankee with all five phases complete.
- LV 299 remains Yankee.
- LV 300 is Zulu with every phase complete and the final center seal.
- LV 309 and LV 310 remain identical Zulu badge and identity states.
- LV 934 and LV 1,000,000 remain `Marshal // Zulu`.
- Negative, fractional, non-finite, and unsafe-integer inputs retain the existing rejection behavior.
- Clearing local data returns the application to `LV 000`, Cadet, and zero pips.
- Reopening, recompleting, editing, or deleting a rewarded todo does not change earned XP or identity.
- A passive load never triggers the promotion animation.

## Test requirements

### Domain tests

Test:

- every base-rank boundary;
- the complete official designation array and order;
- every designation's first and last level;
- permanent Zulu clamping after LV 300;
- the `ProgressionIdentity` invariants;
- next named milestones and the final `null` state;
- pip values only through LV 39;
- all five cumulative phase counters;
- the unique Zulu seal state;
- unchanged XP reference thresholds, including exactly 22,249 XP at LV 300;
- unchanged Active Capacity behavior.

### Renderer tests

Keep deterministic SVG snapshots for:

- all base silhouettes;
- every pip state;
- plain Marshal;
- all 26 designations;
- Zulu at levels above 300.

Assert that all 26 designation SVG outputs are geometrically distinct and that post-Zulu output is stable.

### Application tests

Test:

- structured rank and designation view state;
- wide and narrow HUD layouts;
- exact visible and accessible identity text;
- next-rank and next-designation rows;
- final named-progression state at Zulu;
- promotion feedback for rank, designation, and ordinary level changes;
- no promotion animation on load;
- reduced-motion behavior;
- forced-colors behavior;
- 200 percent text zoom;
- 320-pixel and 390-pixel viewports;
- no horizontal overflow with `MARSHAL // NOVEMBER` and high level numbers.

### Visual regression tests

Add stable screenshot comparisons for:

- the complete badge matrix at 48 and 112 pixels;
- 24-pixel and 32-pixel robustness views;
- grayscale rendering;
- forced-colors rendering;
- compact and expanded HUD examples;
- mobile layouts at 320 and 390 pixels.

Screenshot baselines become final only after user approval of the badge geometry.

## Badge review and route lifecycle

During badge implementation, retain `/badge` as the interactive review page. Expand it to show the complete base-rank, pip, designation, size, grayscale, forced-colors, and HUD matrix.

The user must approve the final matrix before cleanup.

After approval:

1. freeze the accepted screenshot baselines;
2. remove `/badge` from normal application routing and the production bundle;
3. remove inspection-only production CSS and copy;
4. retain the matrix as a test-only fixture;
5. confirm that the fixture is not reachable in the published application.

Exact SVG coordinates are implementation output and are approved through this visual review. They do not belong in this plan.

## Ticket-ready work packages

These packages are numbered in dependency order. A later ticketing step may copy each package into its own file under `.scratch/<feature-slug>/issues/`.

### 01. Introduce the progression taxonomy

**Blocked by:** None.

**What to build:** Separate award, level-curve, taxonomy, and capacity concerns. Add canonical rank and designation tuples, structured identity derivation, and next-milestone derivation without changing persisted data or XP behavior.

**Likely files:**

- `src/config/rules-v1.ts`
- a focused progression configuration module
- `src/domain/progression.ts`
- `src/domain/ranks.ts` or its replacement
- `src/domain/capacity.ts`
- `src/persistence/repository.ts`
- domain tests

**Acceptance criteria:**

- [ ] All final rank and designation boundaries match this plan.
- [ ] Zulu clamps permanently at LV 300.
- [ ] Invalid rank and designation combinations are unrepresentable in the public type.
- [ ] The next named milestone is correct at every boundary.
- [ ] XP thresholds and Active Capacity outputs do not change.
- [ ] Award `rulesVersion` and database version remain unchanged.

### 02. Refactor base-rank badge descriptors and geometry

**Blocked by:** 01.

**What to build:** Replace the string-validated descriptor with the discriminated badge descriptor. Rename Trooper to Specialist, refine the complete base silhouette family, and stop pips at LV 40.

**Likely files:**

- `src/domain/badge-descriptor.ts`
- `src/app/RankBadge.tsx`
- badge domain and renderer tests

**Acceptance criteria:**

- [ ] All nine base silhouettes match the approved family.
- [ ] Cadet through General render zero through four pips.
- [ ] Marshal never renders pips.
- [ ] Badge output remains deterministic and uses one 32-unit geometry.
- [ ] No real-world insignia is copied directly.

### 03. Build cumulative Marshal designation badges

**Blocked by:** 02.

**What to build:** Replace prestige modifiers and hashes with the five cumulative segment families and the Zulu center seal. Expand the temporary review page.

**Likely files:**

- `src/domain/badge-descriptor.ts`
- `src/app/RankBadge.tsx`
- `src/app/BadgeShowcase.tsx`
- `src/styles/app.css`
- badge tests and snapshots

**Acceptance criteria:**

- [ ] All 26 designation states produce unique deterministic SVG geometry.
- [ ] Every phase retains all completed earlier phases.
- [ ] Zulu retains Yankee and adds one unique center seal.
- [ ] Phase and Zulu differences remain visible at 44 and 48 pixels.
- [ ] No glyph, gradient, glow, blur, random value, or generated path is present.
- [ ] The complete review matrix is available on the temporary `/badge` route.

### 04. Integrate identity and milestones into the application

**Blocked by:** 01 and 03.

**What to build:** Carry structured identity through repository view state, HUD, Progression details, accessible names, and completion feedback.

**Likely files:**

- `src/persistence/repository.ts`
- `src/app/App.tsx`
- `src/app/SettingsDialog.tsx`
- `src/styles/app.css`
- application and end-to-end tests

**Acceptance criteria:**

- [ ] UI code does not parse or concatenate a canonical rank string.
- [ ] `//` appears only as visible presentation.
- [ ] HUD uses the approved wide and narrow layouts.
- [ ] Progression details show the current identity and only the next named milestone.
- [ ] Zulu shows that named progression is final.
- [ ] Designation promotion receives its own committed feedback message.
- [ ] Accessible names speak rank and designation without reading punctuation.

### 05. Add promotion activation and accessibility behavior

**Blocked by:** 04.

**What to build:** Add the one-time promotion activation and complete responsive, reduced-motion, forced-colors, and text-zoom behavior.

**Likely files:**

- `src/app/App.tsx`
- `src/app/RankBadge.tsx`
- `src/styles/app.css`
- accessibility and end-to-end tests

**Acceptance criteria:**

- [ ] Activation runs only for a newly committed rank or designation.
- [ ] Activation lasts 200 through 300 milliseconds and does not move layout.
- [ ] Reduced-motion mode disables it.
- [ ] The badge remains decorative and adjacent text remains authoritative.
- [ ] Grayscale and forced colors preserve structural phase differences.
- [ ] The HUD has no horizontal overflow at 320 and 390 pixels or 200 percent text zoom.

### 06. Complete automated and visual regression coverage

**Blocked by:** 03 and 05.

**What to build:** Replace obsolete prestige tests, add all boundary and invariant tests, and add screenshot comparison coverage using the review matrix.

**Likely files:**

- `tests/domain/ranks.spec.ts`
- `tests/domain/badge.spec.ts`
- `tests/domain/rank-badge-renderer.spec.ts`
- renderer snapshots
- `tests/e2e/progression-settings-badges.spec.ts`
- `tests/e2e/badge-showcase.spec.ts`
- `tests/e2e/release-gates.spec.ts`
- visual review tests

**Acceptance criteria:**

- [ ] Every boundary and edge case in this plan has automated evidence.
- [ ] Obsolete atom, hash, repeated-title, and long-rank tests are removed or replaced.
- [ ] Screenshot comparisons cover the required sizes and modes.
- [ ] Mobile accessibility checks run after the mobile viewport is applied.
- [ ] The complete test suite and release gate pass before visual approval.

### 07. Obtain final user badge approval

**Blocked by:** 06.

**What to build:** Present the complete review matrix, apply requested visual corrections, and record approval of the final geometry.

**Acceptance criteria:**

- [ ] The user reviews every base rank and Marshal designation at production sizes.
- [ ] The user reviews compact, detail, grayscale, forced-colors, and mobile contexts.
- [ ] All requested corrections are implemented and retested.
- [ ] The user explicitly approves the final badge set.
- [ ] Accepted screenshot baselines are frozen only after approval.

### 08. Remove the review route and align binding documentation

**Blocked by:** 07.

**What to build:** Remove the review route from the shipped application, retain a test-only fixture, remove old terminology, and update repository contracts and release evidence.

**Likely files:**

- `src/index.tsx`
- badge showcase and test-fixture files
- inspection-only CSS
- `CONTEXT.md`
- `README.md`
- `docs/release-checklist.md`
- this implementation plan's status

**Acceptance criteria:**

- [ ] `/badge` is not reachable in the published application.
- [ ] The accepted matrix remains available to automated tests.
- [ ] Active source and tests contain no `atom` or procedural-prestige terminology.
- [ ] `CONTEXT.md` describes the new taxonomy and the narrower award `rulesVersion` meaning.
- [ ] README no longer advertises procedural ranks.
- [ ] Release Checklist points to the new rank, designation, badge, responsive, and accessibility evidence.
- [ ] `npm run release:check` passes.
- [ ] This plan records implementation and user acceptance as complete.

## Required documentation corrections during implementation

The implementation must correct these current contradictions:

- Replace the general claim that ranks change every five levels with the precise base-rank and Marshal rules.
- State that designations begin after the plain-Marshal band, not immediately on reaching Marshal.
- Replace endless prestige-rank language with permanent Zulu clamping.
- Remove `Trooper` and use `Specialist`.
- Remove references to unspecified XP modifiers.
- Describe "uncapped" as no authored product cap within the supported numeric model.
- Keep the global no-gradient visual rule. There is no badge exception.
- Define plain Marshal and every designation as pip-free.
- Define the phases as cumulative rather than optional visual ideas.
- Define Zulu as Yankee plus the center seal.
- Define exact designation text as the authority and the badge as supporting information.
- Narrow stored `rulesVersion` to award calculation rules.
- Replace "procedural ranks" in current product and release documentation.

## Rejected alternatives

The following choices are closed unless a new design decision explicitly reopens them:

- strict real-world military hierarchy;
- Trooper, Corporal, or Field Marshal substitutions;
- endless prestige atoms or composable titles;
- fewer than 26 or non-NATO designations;
- normalized spellings such as `Alpha`, `Juliet`, or `Xray`;
- designations beginning at LV 45;
- five, fifteen, or twenty levels per designation;
- any named or visual progression after Zulu;
- task difficulty, anti-cheat, or variable Base XP;
- storing rank, designation, or taxonomy version;
- Marshal pips;
- independent colors per designation;
- gradients or a special Zulu color;
- an A through Z badge glyph;
- size-specific badge geometry families;
- a full progression table in Settings;
- a permanently shipped badge inspection route.

## Definition of done

The upgrade is complete only when:

1. domain behavior matches every table and invariant in this plan;
2. XP, reward, capacity, persistence, and database behavior remain unchanged;
3. UI, feedback, animation, accessibility, and responsive behavior match this plan;
4. every required automated and visual test passes;
5. the user approves the final badge matrix;
6. final screenshot baselines record the approved geometry;
7. `/badge` is removed from the published application and a test-only fixture remains;
8. active code and current documentation contain no obsolete prestige-atom model;
9. `CONTEXT.md`, README, and Release Checklist match the implemented system;
10. the local release gate passes.
