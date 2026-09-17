# MECHA//TODO domain context

Status: V1 is implemented. Production deployment is pending.

This file records the product and domain rules that must remain stable across implementation changes. Code owns algorithms and schemas. Tests and `docs/release-checklist.md` own release evidence.

## Product purpose

MECHA//TODO is a personal, browser-local todo list with a small progression system. Its loop is short:

1. Add a real task.
2. Complete it.
3. Receive XP once.
4. See progress and leave the app.

The task list is the main content. Progression supports task completion and must not become another system to maintain.

The product may describe its interaction design as ADHD-friendly or ADHD-oriented. It must not claim to treat ADHD, change dopamine, or provide a clinical benefit.

## Domain vocabulary

Use these terms in domain code, tests, and product documentation:

- A **todo** is one task record.
- **Active** means open and currently visible in the primary task list.
- **Standby** means open but outside the current Active focus set.
- **Completed** means currently checked. It does not mean the todo can earn XP again.
- A **completion award** is the single immutable XP award attached to a todo's first completion.
- **Lifetime XP** is the sum of every completion award, including awards whose todo was later deleted.
- **LINK** is the bonus on today's first eligible completion when yesterday had an award.
- **COMBO** is a bonus on one of four exact daily completion milestones.
- **Rules version** identifies the immutable reward and progression rules used by an award.
- A **local data problem** means the app could not open or trust its IndexedDB data.

Use "browser-local" or "stored in this browser" in user-facing explanations. Do not describe V1 as local-first because V1 makes no offline promise.

## V1 boundary

V1 has one local user per website origin and browser profile. It has no account, backend, cloud storage, synchronization, analytics, telemetry, advertising, or third-party runtime requests.

IndexedDB is authoritative for todos, completion awards, and progression. Local storage may contain only the unfinished composer draft.

The dataset cannot move between origins, browsers, profiles, or devices. Clearing site data, losing a profile or device, changing the production origin, browser eviction, or unrecoverable corruption can permanently remove it. Choose one stable production origin before users enter data they expect to keep.

V1 has no import, export, backup, restore, PWA installation, service worker, or supported offline mode. It has no swipe-only actions or hidden gesture-only controls.

Separate tabs share IndexedDB but do not synchronize their visible state. Transactions protect stored invariants. A tab may require a reload after another tab changes the data.

## Todo contract

A todo contains one line of text. Saving normalizes it as follows:

1. Replace every run of JavaScript Unicode whitespace with one ASCII space.
2. Trim leading and trailing whitespace.
3. Count Unicode code points with `Array.from(value).length`.
4. Accept 1 through 280 code points.

Do not truncate or change casing. Duplicate text is allowed. Todo IDs come from `crypto.randomUUID()` and remain opaque.

Todos have exactly one status: `active`, `standby`, or `completed`.

- Active and Standby sort by immutable creation order, oldest first.
- Completed sorts by the latest completion order, newest first.
- Editing never changes XP, status, creation order, or completion order.
- Active starts open after a page load. Standby and Completed start closed.
- Standby loads the oldest 20 records first. Completed loads the newest 20 records first.

Active capacity is a focus target, not a hard invariant:

```text
activeCapacity(level) = min(8 + floor(level / 5), 16)
```

New todos enter Active while it has capacity and Standby otherwise. Reopening always puts a todo in Active, even above capacity. Completing or deleting an Active todo promotes the oldest Standby todos until Active reaches capacity. Undo restores the deleted todo's former status and never demotes a todo promoted after deletion.

## Completion, deletion, and rewards

A todo can own at most one completion award. Its first completion creates that award. Reopening, completing it again, editing it, and deleting it never create, remove, or change the award.

Deleting a rewarded todo keeps its Lifetime XP. The award remains as anonymous history with an opaque todo ID and no task text. Deletion commits immediately and offers one in-memory Undo action for five seconds. Closing or reloading the page discards Undo.

Reward rules V1 are immutable:

| Rule | Value |
|---|---:|
| Base XP | 10 |
| LINK bonus | 5 |
| COMBO at ordinal 5 | 2 |
| COMBO at ordinal 10 | 4 |
| COMBO at ordinal 15 | 6 |
| COMBO at ordinal 20 | 8 |
| Levels per rank | 5 |
| Level-100 pacing anchor | 500 base completions |

LINK applies only to today's first completion when the immediately preceding local calendar day has an award. COMBO applies only at ordinals 5, 10, 15, and 20. One V1 award cannot contain both bonuses.

Day keys use the device's local calendar when the first completion commits. Later clock or timezone changes do not rewrite history. V1 has no anti-cheat or retroactive reward recalculation.

Completion awards are the source of truth for Lifetime XP. Level, rank, current-level progress, and badges are derived. A rank changes every five levels. Prestige ranks continue after Marshal. Badge generation is deterministic and contains no randomness.

The exact reward constants live in `src/config/rules-v1.ts`. Progression, rank, reward, and badge algorithms live under `src/domain/`.

## Persistence and failure behavior

The V1 IndexedDB database is named `mecha-todo`. Its authoritative stores are:

- `todos`
- `completionAwards`
- `meta`

Open todos have null completion fields. Completed todos have non-null completion fields and a matching completion award. Award records are immutable after commit. Ordering counters and cached derived statistics can be rebuilt, but completion awards remain authoritative.

Startup validates core metadata, todos, and completion awards before showing the ready state. V1 does not quarantine, repair, skip, or silently discard malformed authoritative records. It does not fall back to an in-memory list that appears persistent.

A local data problem blocks normal task use and offers Retry or confirmed local-data erasure. No automatic path may delete or recreate the database. Confirmed erasure clears todos, awards, metadata, and the composer draft, then returns the app to level 0 Cadet.

Components access persistence through the repository. They do not access IndexedDB directly. Every successful mutation commits before reward feedback appears.

Future database versions require an ordered migration, validation, a fixture, and a test for every released version that remains supported.

## Interface contract

The ready screen has no visible product-name header. Its order is:

1. Compact progression HUD.
2. Open Active, closed Standby, and closed Completed sections.
3. Task composer with nonmodal reward and status feedback.

All viewport sizes use one left-aligned task column. Mobile keeps the HUD and composer available around the task-list scroll region. Tablet and desktop center the same hierarchy instead of introducing dashboard columns.

Settings contains progression details, browser-local data information, version information, and local-data erasure. It fills the mobile viewport and uses a constrained modal on tablet and desktop.

Current empty-state copy is:

```text
Nothing active right now. Add a task when you're ready.
Nothing on standby right now. Extra tasks will wait here.
Nothing completed yet. Finished tasks will collect here.
```

Use sentence case for actions, errors, empty states, confirmations, and explanations. Uppercase is reserved for the product mark, rank display, terse system labels, and short status feedback. Do not use shame, false urgency, or clinical claims.

The visual language draws from late-1990s mecha command displays without copying franchise assets. The procedural badge carries most of the character. Borders and color communicate structure or state. Avoid decorative grids, gradients, glass effects, ornamental telemetry, and motion that does not explain a state change.

Every action must work with touch, mouse, and keyboard. Interactive targets are at least 44 by 44 CSS pixels. Preserve visible focus, semantic names, reduced motion, forced-colors support, readable completed text, managed dialog focus, and no horizontal overflow at the release viewports.

## Release and future changes

`npm run release:check` is the local V1 release gate. `docs/release-checklist.md` maps acceptance criteria to automated evidence and stays in the repository until the first production deployment has passed its smoke test.

Production is a static build on one stable HTTPS origin. Do not add server functions, secrets, a server database, a manifest, or a service worker for V1. Production sends task data nowhere.

Changes to reward values require a new rules version that preserves V1 awards. Login, Turso, synchronization, or browser-local data adoption require a new specification before implementation. A display-name change updates product configuration and visible assets but must not rename the browser database.
