# MECHA//TODO — Rank & Designation Progression IDEA

## Purpose

This document captures the current design direction for the **rank, designation, level, and badge progression system** in MECHA//TODO.

It is intentionally an **IDEA / design handoff**, not an implementation plan.

The next step should be a **grilling session** where an agent inspects this proposal, looks for contradictions, edge cases, pacing problems, naming problems, UI/UX issues, implementation risks, and unclear assumptions.

The agent should **challenge this document aggressively** before turning it into tickets or implementation work.

---

# 1. Context

MECHA//TODO is a gamified todo app with a strong:

- mecha
- military
- tactical terminal
- 90s anime
- Neon Genesis Evangelion / military sci-fi inspired

visual and thematic direction.

The progression system should feel like a **military/mecha personnel classification system**, not like a fantasy RPG.

The current system was designed to scale technically to extremely large levels such as:

```text
LV 1,000,000
```

but that led to a procedural prestige naming system that could generate increasingly absurd titles.

Examples of the old conceptual direction:

```text
PRIME MARSHAL
VANGUARD MARSHAL
APEX MARSHAL
PRIME-PRIME MARSHAL
...
```

This solves an infinite-content problem that probably does not need to exist.

The new direction is:

> **Levels may continue indefinitely, while ranks and designations are deliberately finite.**

The numeric level itself becomes the long-term veteran indicator once all named progression has been exhausted.

---

# 2. Core Design Goals

The system should:

1. feel immediately understandable;
2. be inspired by real-world military hierarchy;
3. still strongly fit the mecha / 90s anime aesthetic;
4. avoid fantasy-style rank inflation;
5. provide fast early progression;
6. provide much slower long-term progression;
7. allow numeric levels to scale indefinitely;
8. keep badge generation simple and deterministic;
9. avoid needing hundreds or thousands of rank names;
10. remain visually readable at small icon sizes;
11. be easy to maintain and test;
12. preserve a satisfying sense of progression for long-term users.

---

# 3. Proposed Progression Model

The system is split into three separate concepts:

```text
LEVEL
  ↓
BASE RANK
  ↓
DESIGNATION
```

These should remain conceptually separate.

## Level

Level is numeric and effectively unbounded.

Examples:

```text
LV 042
LV 067
LV 300
LV 934
LV 1000000
```

Level should continue increasing after the final named progression state has been reached.

---

# 4. Base Rank Ladder

The proposed rank ladder is:

```text
LV 000–004  CADET
LV 005–009  SPECIALIST
LV 010–014  SERGEANT
LV 015–019  LIEUTENANT
LV 020–024  CAPTAIN
LV 025–029  MAJOR
LV 030–034  COLONEL
LV 035–039  GENERAL
LV 040–049  MARSHAL
```

The rank changes every **5 levels**.

## Why these ranks?

The idea is deliberately not to reproduce a real military structure exactly.

Instead, the hierarchy should:

- borrow recognizable military terminology;
- feel naturally ordered;
- avoid near-duplicate ranks;
- remain easy to understand;
- work well visually in a tactical HUD;
- fit the mecha/anime theme.

### Notes

`CADET`

- onboarding / unproven state;
- works well at LV000;
- does not need to be treated as a strict real-world rank.

`SPECIALIST`

- replaces the previous `TROOPER`;
- feels more technical;
- better matches the idea of a mecha/operator/system user;
- still exists as real military terminology.

`SERGEANT`

- strong NCO-style milestone;
- highly recognizable.

`LIEUTENANT`

- first obvious officer-style rank;
- good thematic transition.

`CAPTAIN`

- strong military and anime/mecha association;
- short and recognizable.

`MAJOR`

- natural next step.

`COLONEL`

- senior-command feel.

`GENERAL`

- conventional military summit.

`MARSHAL`

- final permanent base rank;
- intentionally sits above General in the app's fictionalized hierarchy;
- serves as the foundation for long-term designation progression.

---

# 5. Why Base Ranks Stay at 5 Levels

One alternative would be to make every base rank last 10 levels.

Current preferred direction:

```text
BASE RANK STEP = 5 levels
```

Reasoning:

- early progression should feel fast;
- users should see meaningful rewards early;
- the designation system already creates the long-term runway;
- delaying Marshal too much does not add much value;
- increasing designation spacing has much greater impact on overall progression length than increasing base-rank spacing.

Current target:

```text
MARSHAL begins at LV 040
```

---

# 6. Designations

After reaching Marshal, progression switches from base-rank advancement to **designation advancement**.

The old internal concept name `atom` should be removed.

Use:

```text
designation
```

internally and in design documentation.

Possible implementation naming:

```text
Designation
designation
DESIGNATIONS
designationIndex
designationForLevel()
```

Avoid keeping `atom` as legacy terminology unless required temporarily during migration.

---

# 7. NATO Phonetic Alphabet as Designations

The proposed designation sequence is:

```text
ALFA
BRAVO
CHARLIE
DELTA
ECHO
FOXTROT
GOLF
HOTEL
INDIA
JULIETT
KILO
LIMA
MIKE
NOVEMBER
OSCAR
PAPA
QUEBEC
ROMEO
SIERRA
TANGO
UNIFORM
VICTOR
WHISKEY
X-RAY
YANKEE
ZULU
```

Important:

Use the official NATO spellings where practical:

```text
ALFA
JULIETT
X-RAY
```

rather than silently normalizing them to:

```text
ALPHA
JULIET
XRAY
```

This should be challenged during grilling if there are good product/UX reasons to deviate.

---

# 8. Designation Spacing

Designations begin **after plain Marshal**.

Preferred spacing:

```text
DESIGNATION STEP = 10 levels
```

Result:

```text
LV 040–049  MARSHAL

LV 050–059  MARSHAL // ALFA
LV 060–069  MARSHAL // BRAVO
LV 070–079  MARSHAL // CHARLIE
LV 080–089  MARSHAL // DELTA
LV 090–099  MARSHAL // ECHO
...
LV 300–309  MARSHAL // ZULU
```

Afterward:

```text
LV 310+     MARSHAL // ZULU
```

The numeric level continues forever.

---

# 9. Presentation

Preferred compact presentation:

```text
LV 042 · MARSHAL
```

For designated Marshal states:

```text
LV 067
MARSHAL // BRAVO
```

Example later progression:

```text
LV 094
MARSHAL // ECHO
```

```text
LV 300
MARSHAL // ZULU
```

```text
LV 934
MARSHAL // ZULU
```

The exact typography/layout may vary by component.

Important semantic rule:

> `MARSHAL` remains the rank.  
> `ECHO`, `ZULU`, etc. are designations, not new ranks.

Avoid representing them as a single artificial rank string in domain logic if possible.

Prefer something conceptually like:

```ts
{
  level: 94,
  rank: "MARSHAL",
  designation: "ECHO"
}
```

rather than:

```ts
{
  rank: "ECHO MARSHAL"
}
```

---

# 10. Total Named Progression Runway

There are:

```text
9 base rank states
26 designation states
```

For a total of:

```text
35 distinct named progression identities
```

The final unique named combination begins at:

```text
LV 300
MARSHAL // ZULU
```

After this, only the numeric level changes.

This is intentional.

---

# 11. Approximate Todo Runway

The current XP system has a rising level curve.

Using the current curve, reaching:

```text
LV 300
MARSHAL // ZULU
```

takes roughly:

```text
~2,000 completed todos
```

depending on actual bonus usage.

The exact number varies because the app includes XP bonuses such as:

- LINK / streak-like continuity bonuses;
- daily completion milestone bonuses;
- other existing XP modifiers.

The important design conclusion is:

> 10 levels per designation already produces a long progression runway.

---

# 12. Approximate Usage Timeline

Because task granularity varies heavily between users, there is no universal correct number of todos per day.

For design purposes, the current rough usage bands are:

```text
3/day    light usage
5/day    normal/moderate usage
10/day   heavy regular usage
15+/day  very heavy usage
```

With the current XP curve and bonuses, approximately:

| Average completed todos | Approximate time to ZULU |
|---|---:|
| 3/day | ~1.7 years if used daily |
| 5/day | ~1.1 years if used daily |
| 10/day | ~6–7 months if used daily |
| 15/day | ~4–5 months if used daily |
| 20/day | ~3 months if used daily |

For weekday/workday-style usage, the real calendar duration is longer.

Rough example:

```text
5 todos/day
5 active days/week
≈ 1.5 years to ZULU
```

This currently feels acceptable.

The grilling session should explicitly challenge whether this runway is:

- too short;
- too long;
- appropriate;
- too dependent on task granularity;
- vulnerable to users creating trivial todos for progression.

---

# 13. Alternative Spacing Options to Evaluate

Current preference:

```text
BASE RANKS:     5 levels
DESIGNATIONS:  10 levels
```

Alternatives worth challenging:

```text
BASE RANKS:    10 levels
DESIGNATIONS:  10 levels
```

or:

```text
BASE RANKS:     5 levels
DESIGNATIONS:  15 levels
```

or:

```text
BASE RANKS:     5 levels
DESIGNATIONS:  20 levels
```

Current reasoning:

- increasing base rank spacing mainly delays Marshal;
- increasing designation spacing has a much larger effect on long-term progression;
- therefore, if pacing needs to become slower, prefer increasing designation spacing first.

Do not change this silently during implementation.

It should first be challenged during grilling.

---

# 14. Badge System

Each base rank should have its own recognizable core silhouette.

Current conceptual mapping:

```text
CADET        basic chevron
SPECIALIST   double chevron
SERGEANT     stepped chevron
LIEUTENANT   diamond
CAPTAIN      double diamond
MAJOR        winged diamond
COLONEL      shield/bars
GENERAL      star/wing
MARSHAL      heavy crest
```

These are conceptual directions, not final SVG specifications.

The grilling session should challenge:

- whether the silhouettes are visually distinct enough;
- whether any accidentally resemble real-world protected insignia too closely;
- whether they remain readable at 16px / 24px / 32px / 48px;
- whether Specialist should use a different symbol than double chevron;
- whether Marshal is visually strong enough to support 26 designation variations.

---

# 15. Marshal Badge Architecture

All post-Marshal designations should use the **same base Marshal SVG geometry**.

Do NOT create 26 completely unrelated Marshal badges.

Conceptually:

```text
Marshal base geometry
        +
designation treatment
        =
Marshal designation badge
```

Possible SVG layers:

```text
<svg>
  <defs>
    gradients
    masks
    clipPaths
    reusable effects
  </defs>

  <g id="base">
    Marshal geometry
  </g>

  <g id="designation-fill">
    designation fill / gradient
  </g>

  <g id="designation-segments">
    activated structural pieces
  </g>

  <g id="designation-frame">
    optional border/frame
  </g>

  <g id="designation-code">
    optional A–Z glyph
  </g>
</svg>
```

This should allow a single reusable Marshal asset with programmatic treatment.

---

# 16. Designation Visual Philosophy

Avoid this:

```text
ALFA      red
BRAVO     blue
CHARLIE   orange
DELTA     green
...
```

Twenty-six unrelated colors would feel arbitrary and would not communicate advancement.

Preferred direction:

> Designation visuals should be cumulative.

Later designations should visually look like upgrades of earlier ones.

---

# 17. Proposed 26-Step Visual Progression

The alphabet can be grouped into five-step visual phases plus ZULU as the final state.

## Phase 1 — A–E: Core Activation

```text
ALFA      core 1/5
BRAVO     core 2/5
CHARLIE   core 3/5
DELTA     core 4/5
ECHO      core 5/5
```

Possible treatment:

- inner crest segments activate progressively;
- fixed structural geometry;
- progressively stronger fill coverage.

---

## Phase 2 — F–J: Edge Activation

```text
FOXTROT   edge 1/5
GOLF      edge 2/5
HOTEL     edge 3/5
INDIA     edge 4/5
JULIETT   edge 5/5
```

Possible treatment:

- outer edge segments;
- corner accents;
- additional structural highlights.

---

## Phase 3 — K–O: Secondary Layer

```text
KILO      layer 1/5
LIMA      layer 2/5
MIKE      layer 3/5
NOVEMBER  layer 4/5
OSCAR     layer 5/5
```

Possible treatment:

- secondary fill;
- split fill;
- controlled gradient;
- additional inner pattern.

---

## Phase 4 — P–T: Outer Frame

```text
PAPA      frame 1/5
QUEBEC    frame 2/5
ROMEO     frame 3/5
SIERRA    frame 4/5
TANGO     frame 5/5
```

Possible treatment:

- segmented second outline;
- crest enclosure;
- armor-like external frame.

---

## Phase 5 — U–Y: Energy Nodes

```text
UNIFORM   node 1/5
VICTOR    node 2/5
WHISKEY   node 3/5
X-RAY     node 4/5
YANKEE    node 5/5
```

Possible treatment:

- small edge nodes;
- wing-tip lights;
- hard-edged "energy" indicators;
- tactical status blocks.

---

## Final — ZULU

Zulu represents the fully activated Marshal badge.

Potential traits:

```text
full core
full edge
full secondary layer
full outer frame
all nodes active
special center treatment
```

Zulu should feel visually final without requiring radically different geometry.

---

# 18. Gradients, Effects, Borders, and SVG Styling

Current app styling may intentionally avoid decorative gradients.

For progression badges, consider a narrow exception:

> Gradients and SVG effects are allowed when they directly encode progression state.

Preferred:

- hard-edged layers;
- masks;
- clip paths;
- stepped fills;
- border thickness;
- secondary borders;
- segmented outlines;
- opacity changes;
- controlled linear/radial gradients;
- crisp geometric "energy" elements.

Avoid excessive:

- blur;
- bloom;
- neon glow;
- soft shadows;
- generic cyberpunk effects.

Reason:

At small badge sizes, soft glow often destroys legibility.

The app wants a:

```text
90s tactical / mecha terminal
```

look more than a:

```text
modern neon gamer UI
```

look.

---

# 19. Optional A–Z Glyph

Because each NATO designation corresponds to one alphabet letter, the Marshal badge may optionally include a small glyph:

```text
A = ALFA
B = BRAVO
...
Z = ZULU
```

This could appear as:

- small center glyph;
- tiny tactical marking;
- embedded pixel letter;
- edge identifier;
- serial-style marking.

Important:

The glyph must not be required for understanding the user's progression.

The text label remains authoritative:

```text
MARSHAL // ECHO
```

The badge should remain decorative/supportive.

---

# 20. Pips / Within-Rank Progress

The old system used smaller advancement markers / pips within rank bands.

This should be reconsidered.

Current preferred direction:

## Before Marshal

The badge may show small within-rank progression markers if useful.

Example:

```text
rank silhouette + 0–4 advancement pips
```

because base ranks span 5 levels.

## After Marshal

Do **not** automatically create 0–9 pips for ten-level designation bands.

Reason:

- clutter;
- poor readability;
- duplication of the level number;
- XP/progress bars already show exact progress;
- designation treatment itself should carry the prestige identity.

Preferred:

```text
MARSHAL // designation
+
numeric level
+
normal XP progress UI
```

without encoding every intermediate level directly into the badge.

This should be challenged during grilling.

---

# 21. Domain Model Direction

Possible conceptual model:

```ts
type BaseRank =
  | "CADET"
  | "SPECIALIST"
  | "SERGEANT"
  | "LIEUTENANT"
  | "CAPTAIN"
  | "MAJOR"
  | "COLONEL"
  | "GENERAL"
  | "MARSHAL";

type Designation =
  | "ALFA"
  | "BRAVO"
  | "CHARLIE"
  | ...
  | "ZULU";

type ProgressionState = {
  level: number;
  rank: BaseRank;
  designation: Designation | null;
};
```

Possible badge descriptor:

```ts
type BadgeDescriptor = {
  rank: BaseRank;
  designation: Designation | null;

  designationStyle?: {
    index: number;
    letter: string;
    phase: number;
    phaseProgress: number;
  };
};
```

These are conceptual examples only.

The grilling session should challenge whether:

- phase/phaseProgress belongs in domain logic;
- these should be derived instead of stored;
- rank/designation should be enums, const arrays, or lookup data;
- any data should be persisted at all;
- everything should instead be derived from level.

Preferred principle:

> Store as little progression state as possible. Derive rank/designation from level whenever feasible.

---

# 22. Important Non-Goal

Do NOT build an endlessly composable designation naming system.

We explicitly do not want:

```text
ALFA-BRAVO MARSHAL
OMEGA PRIME MARSHAL
ZULU-II MARSHAL
MARSHAL // ZULU // PRIME
```

The final state is intentionally:

```text
MARSHAL // ZULU
```

Afterward:

```text
level continues
```

No additional naming layer is required.

---

# 23. Open Questions for the Grilling Session

The grilling agent should explicitly challenge at least the following.

## Progression

1. Is LV040 too early for Marshal?
2. Is 5 levels per base rank too fast?
3. Is 10 levels per designation too fast or too slow?
4. Is ~2,000 todos to ZULU appropriate?
5. Does the system reward users who create tiny fake todos too much?
6. Should task difficulty affect XP?
7. Does that belong in this project at all, or would it overcomplicate the app?
8. Should post-ZULU levels remain fully uncapped?
9. Should there be any special visual milestone after ZULU even if no new designation exists?
10. Does LV300 feel like a good point for the final named state?

## Rank Naming

11. Is `SPECIALIST` definitely better than `CORPORAL`?
12. Does `SPECIALIST → SERGEANT` feel natural?
13. Is `MARSHAL` the right final rank?
14. Should `FIELD MARSHAL` be considered, or is that too literal?
15. Are any ranks too Army-specific for the intended fiction?
16. Should the app instead define its own fictional organization terminology around otherwise-real ranks?

## NATO Designations

17. Does the NATO phonetic alphabet fit the app strongly enough?
18. Is using NATO terminology too literal / too real-world?
19. Should official spellings such as `ALFA` and `JULIETT` be preserved?
20. Does `HOTEL`, `GOLF`, or `PAPA` feel unintentionally silly in a rank UI?
21. Is that acceptable because they are explicitly designations?
22. Should all 26 be used?
23. Should some alternate fictional designation system be compared before committing?
24. Should designation order always strictly match A–Z?

## Presentation

25. Is:

```text
LV 067
MARSHAL // BRAVO
```

the strongest presentation?

26. Alternatives to compare:

```text
LV 067 · MARSHAL // BRAVO
```

```text
MARSHAL
DESIGNATION // BRAVO
LV 067
```

```text
MARSHAL / BRAVO
LV 067
```

27. Should `//` remain a core brand separator?
28. Should the compact and expanded presentation differ?

## Badge Visuals

29. Are cumulative badge upgrades better than independent color themes?
30. Should all 26 designations have visibly unique badges?
31. Is five five-step phases + ZULU elegant or too artificial?
32. Should phase changes be much more visually dramatic than within-phase changes?
33. Should color change by phase?
34. Should hue stay mostly fixed while complexity increases?
35. Should ZULU introduce a unique accent color?
36. Should the A–Z glyph be visible?
37. Can the badge remain readable at very small sizes?
38. Should the badge be optimized primarily for 24px, 32px, or ~48px?
39. Should a simplified small-size SVG variant exist?
40. Are gradients acceptable inside badges?
41. Are borders and hard-edge effects enough without gradients?
42. Should effects be fully deterministic CSS/SVG, or should each phase be manually authored?

## Accessibility

43. Does any information rely on color alone?
44. Will the badge still work in grayscale?
45. Does the textual rank/designation always remain available in important contexts?
46. Are contrast requirements met?
47. Will gradients or transparency create unreadable states?

## Engineering

48. Should rank and designation be entirely derived from level?
49. Should level-to-designation mapping be table-driven?
50. Should the design system expose a generic badge descriptor?
51. Should Marshal use one SVG with layered modifiers or generated paths?
52. Should base-rank SVGs be handcrafted?
53. Should designation layers be authored as reusable SVG fragments?
54. How should the system handle theme changes later?
55. Should badge snapshots be tested visually?
56. Which parts deserve unit tests?
57. How should migration from the old `atom` terminology be handled?
58. Are there persisted old rank strings that require migration?
59. Does any existing code assume every 5 levels always creates a new rank-like state?

---

# 24. What the Grilling Session Should Produce

The grilling session should NOT immediately implement this.

Its output should be a refined design decision document containing:

1. confirmed decisions;
2. rejected alternatives;
3. unresolved decisions requiring user input;
4. identified contradictions;
5. pacing risks;
6. naming risks;
7. visual risks;
8. accessibility concerns;
9. migration concerns;
10. engineering implications;
11. proposed final rank table;
12. proposed final designation table;
13. proposed badge progression model;
14. edge cases;
15. concrete questions that still require product-owner decisions.

Only after that should this be converted into an implementation plan or tickets.

---

# 25. Decisions Currently Considered Strong

Unless grilling finds a strong reason otherwise, the current preferred direction is:

```text
LEVEL
numeric and uncapped
```

```text
BASE RANK STEP
5 levels
```

```text
RANKS
CADET
SPECIALIST
SERGEANT
LIEUTENANT
CAPTAIN
MAJOR
COLONEL
GENERAL
MARSHAL
```

```text
MARSHAL
starts at LV040
```

```text
DESIGNATION STEP
10 levels
```

```text
DESIGNATIONS
NATO phonetic alphabet
ALFA → ZULU
```

```text
FINAL UNIQUE NAMED STATE
LV300
MARSHAL // ZULU
```

```text
POST-ZULU
level continues forever
rank/designation stay MARSHAL // ZULU
```

```text
BADGES
handcrafted base rank silhouettes
+
one reusable Marshal geometry
+
cumulative SVG designation treatments
```

```text
INTERNAL TERMINOLOGY
designation
not atom
```

---

# 26. Guiding Principle

The progression system should feel like:

```text
an increasingly decorated veteran operator
```

not:

```text
an endlessly escalating fantasy title generator
```

The strongest desired end-state is something like:

```text
LV 042 · MARSHAL
```

eventually becoming:

```text
LV 067
MARSHAL // BRAVO
```

and much later:

```text
LV 300
MARSHAL // ZULU
```

while still allowing:

```text
LV 934
MARSHAL // ZULU
```

without requiring another invented rank.

The high level number itself should be allowed to carry prestige.
