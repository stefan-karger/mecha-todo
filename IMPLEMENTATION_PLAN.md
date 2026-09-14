# MECHA//TODO implementation plan

Status: Revised V1 specification after the scope review completed on 2026-09-14.

Source: <code>docs/MECHA_TODO_IDEA_V4.md</code>, the earlier implementation plan, and the product decisions recorded during the September 2026 scope review.

This document is the implementation contract for V1. It supersedes the earlier plan. If it conflicts with the IDEA document, this document wins.

Product rules in this file require an explicit product decision to change. Implementation details may change when they preserve the stated behavior and acceptance criteria. This plan does not authorize work outside V1.

## 1. Product contract

<code>MECHA//TODO</code> is the working display name. Visible naming must come from one product configuration module because the name may change.

~~~ts
export const PRODUCT_NAME = "MECHA//TODO";
export const PRODUCT_SLUG = "mecha-todo";
~~~

Use the neutral slug for package names, database names, and browser-storage keys. Do not put the display name into schema or migration semantics.

MECHA//TODO is a personal, browser-local todo list with a small progression system:

~~~text
capture a real task
complete it
receive XP once
see progress
leave the page
~~~

The task list is the main content. Progression supports task completion and must not become another system that needs maintenance.

The product may describe its interaction design as ADHD-friendly or ADHD-oriented. It must not claim to treat ADHD, change dopamine, or provide a clinical benefit.

V1 is a responsive web app. It is not a Progressive Web App. It has no installation flow, service worker, application-shell cache, or supported offline mode.

## 2. User, data, and runtime boundary

V1 has one browser-local user per website origin and browser profile. It has no account, backend, cloud storage, device synchronization, or portable data format.

IndexedDB contains the authoritative todos and completion awards. A versioned local-storage key may contain an unfinished composer draft.

The dataset cannot move between browsers, profiles, devices, or website origins in V1. Clearing site data, losing a profile or device, changing the production origin, browser eviction, or unrecoverable corruption can permanently remove it. The interface and README must state that the list is stored only in the current browser.

Choose the stable production origin before anyone enters data they expect to keep. Preview deployments and later hostname changes create separate datasets with no V1 transfer path.

Two tabs under the same origin and profile access the same IndexedDB database, but V1 provides no live tab synchronization:

- IndexedDB transactions and uniqueness constraints protect stored invariants.
- Each mutation reads the current stored record inside its transaction.
- If another tab removed the target, the mutation fails with a reload instruction.
- Concurrent text edits use last successful write wins.
- A tab does not promise to display another tab's changes until reload.
- Do not add <code>BroadcastChannel</code>, client identity, record revisions, stale-editor reconciliation, or a synchronization protocol.

V1 assumes network access when the user loads or reloads the app. Ordinary browser caching may sometimes satisfy those requests, and an open page may keep working after connectivity drops. Neither behavior is promised or tested as offline support.

Automated release evidence comes from Google Chrome at three representative viewport sizes. This is a test boundary, not a browser-support guarantee. Do not claim full support for Chrome or any other browser.

## 3. V1 scope

V1 includes:

- adding, editing, completing, reopening, and deleting one-line todos;
- a focused Active Bay and a collapsed Standby queue;
- completed history with incremental loading;
- visible status and deletion controls for touch, mouse, and keyboard;
- first-completion-only XP;
- the daily LINK bonus and milestone-only COMBO bonuses;
- levels, procedural ranks, and deterministic pixel badges;
- IndexedDB persistence and an unfinished composer draft in local storage;
- strict startup validation, explicit migration handling, and a simple local-data error state;
- deliberate local-data erasure with a confirmation dialog;
- responsive mobile, tablet, and desktop layouts built from one information hierarchy;
- English interface copy with device-locale date and number formatting;
- WCAG 2.2 AA-aligned behavior, visible focus, reduced motion, and forced-colors support;
- Playwright tests for pure domain rules and browser behavior;
- a static deployment on one stable HTTPS origin.

V1 does not include:

- a PWA manifest, service worker, install prompt, installed display mode, offline shell, or custom application-update flow;
- backups, file import, file export, restore, rollback, data transfer, or raw diagnostic export;
- accounts, authentication, Turso, an API, cloud persistence, or device synchronization;
- live synchronization between tabs or stale-edit conflict handling;
- persistent-storage permission requests, durability status, or storage-protection controls;
- Quarantine, Recovery Mode, recovery snapshots, record salvage, or automatic repair of malformed authoritative data;
- swipe gestures;
- due dates, reminders, recurrence, projects, tags, priorities, subtasks, notes, calendars, or manual sorting;
- AI task decomposition;
- currencies, shops, inventory, loot, achievements, leaderboards, social features, health, damage, or streak punishment;
- notifications, audio, or haptics;
- analytics, telemetry, crash reporting, remote fonts, advertising, or third-party runtime requests;
- user-configurable progression rules;
- a native wrapper;
- non-English interface copy;
- release tests for multiple browsers, physical devices, huge UI datasets, or extreme-level presentation.

## 4. Domain vocabulary

Use these terms in domain code, tests, and product documentation:

- A **todo** is one task record. Interface labels may call it a directive, but domain code uses <code>todo</code>.
- **Active** means visible in Active Bay.
- **Standby** means open but outside the current Active Bay focus set.
- **Completed** means currently checked. It does not mean the todo can earn XP again.
- A **completion award** is the single immutable XP award attached to a todo's first completion.
- **Lifetime XP** is the sum of every completion award, including awards whose todo was later deleted.
- **LINK** is the bonus on today's first eligible completion when yesterday had an award.
- **COMBO** is a bonus on one of four exact daily completion milestones.
- **Rules version** identifies the immutable reward and progression contract used by an award.
- A **local data problem** means the app could not open or trust its IndexedDB data.

Use "browser-local" or "stored in this browser" in user-facing explanations. Reserve "origin" for engineering and deployment documentation. Do not describe V1 as local-first because V1 makes no offline promise.

## 5. Todo rules

### 5.1 Text validation

A todo contains one line of text.

Normalize a value when the user saves it:

1. Replace every run of JavaScript Unicode whitespace with one ASCII space.
2. Trim leading and trailing whitespace.
3. Count Unicode code points with <code>Array.from(value).length</code>.
4. Accept 1 through 280 code points.

Do not truncate. Preserve casing and every non-whitespace character. Do not apply Unicode normalization beyond whitespace handling. Duplicate text is allowed.

An empty or overlong value keeps the composer or row in edit mode and shows a specific inline error. The database does not change.

Use <code>crypto.randomUUID()</code> for todo IDs. Treat IDs as opaque after creation.

### 5.2 Adding and editing

The composer has one text input and one Add action.

- <code>Enter</code> and a mobile keyboard's Done action save.
- A successful add clears the composer.
- On a fine-pointer device, focus remains in the composer.
- On a coarse-pointer device, the virtual keyboard may close after the save.
- A failed save keeps the text and focus context.
- If the new todo enters Standby, show <code>ADDED TO STANDBY</code>.

Save the unfinished composer value to a versioned local-storage key as the user types. Restore it only under the same origin and profile. Clear it after a successful add or deliberate local-data erasure. A local-storage failure must not prevent todo use.

The user can edit Active, Standby, and Completed todos inline by activating their text.

- <code>Enter</code> and mobile Done save an edit.
- Blur attempts to save.
- <code>Escape</code> cancels on a keyboard device.
- Invalid text leaves the row in edit mode with its draft intact.
- Editing never changes XP, status, creation order, or completion order.
- A regular page reload may discard an unfinished row edit.
- If another tab removed the record, saving fails and instructs the user to reload.
- Concurrent valid text saves use last successful write wins.

### 5.3 Status and ordering

Todos have exactly one status:

~~~ts
type TodoStatus = "active" | "standby" | "completed";
~~~

Active and Standby todos sort by immutable creation order, oldest first. Reopening keeps the original creation order. Completed todos sort by their most recent completion order, newest first. IDs break any remaining tie.

Allocate monotonic <code>creationOrder</code> and <code>completionOrder</code> integers in the same transaction as the mutation. Do not use wall-clock timestamps for ordering. Timestamps remain available for display and diagnostics.

Standby and Completed start collapsed on a fresh page load. Disclosure state exists only in memory for that page.

When expanded:

- Completed initially loads the newest 20 records.
- <code>Show 20 older</code> loads the next 20.
- Standby initially loads the oldest 20 records.
- <code>Show 20 more</code> loads the next 20.

Todos remain in IndexedDB until the user deletes them or erases local data.

### 5.4 Active Bay capacity

Capacity is a focus target, not a hard invariant.

~~~ts
activeCapacity(level) = Math.min(8 + Math.floor(level / 5), 16)
~~~

| Level | Rank | Capacity |
|---:|---|---:|
| 0 through 4 | Cadet | 8 |
| 5 through 9 | Trooper | 9 |
| 10 through 14 | Sergeant | 10 |
| 15 through 19 | Lieutenant | 11 |
| 20 through 24 | Captain | 12 |
| 25 through 29 | Major | 13 |
| 30 through 34 | Colonel | 14 |
| 35 through 39 | General | 15 |
| 40 and above | Marshal or prestige rank | 16 |

New-todo placement is the only operation constrained by capacity:

- Add the todo as Active when <code>activeCount &lt; capacity</code>.
- Otherwise add it as Standby.

Reopening a Completed todo always makes it Active. This may put Active Bay above capacity. Do not reject the reopen or demote another todo.

When an Active todo completes or is deleted, promote the oldest Standby todos until Active reaches capacity. Promote none while Active remains at or above capacity.

A completion may increase capacity. Fill every new slot in the completion transaction. Completing a Standby todo also runs the fill step. Promotion never changes creation order.

Undoing a deletion restores the former status even when that leaves Active Bay over capacity. Do not demote a todo promoted after the deletion.

## 6. Task interaction and feedback

Every row has a leading status control with a minimum 44 by 44 CSS pixel target:

- Activating it on Active or Standby completes the todo.
- Activating it on Completed reopens the todo.
- Activating task text enters inline edit mode.
- A visible trailing Delete action is available through touch, mouse, and keyboard.

V1 has no swipe actions or hidden gesture-only controls.

### 6.1 Completion feedback

Show the checked or reopened state immediately, then start the repository transaction.

- Disable repeated actions on the same pending row.
- Leave other rows interactive.
- On failure, restore the prior row and focus context and show a specific save error.
- Show XP only after commit.
- Keep a newly checked row in place briefly so the user can see what changed, then move it to Completed.
- Treat the hold duration as an implementation detail. It must not block another action.
- Respect reduced motion. A static checked hold may remain.

Use one nonmodal feedback area for the latest committed result. Do not aggregate rapid rewards or define timing windows for feedback visibility. A polite live region announces the same result once.

### 6.2 Reopen, re-complete, and delete copy

Use these status messages:

~~~text
TASK REOPENED · XP RETAINED
TASK COMPLETE · ALREADY CREDITED
TASK DELETED · XP RETAINED
~~~

A never-rewarded deletion uses <code>TASK DELETED</code>.

Deletion commits immediately and offers one nonmodal Undo action for five seconds. Keep the deleted <code>TodoRecord</code> only in memory during that window. Closing or reloading the page discards Undo.

Undo succeeds only when the todo ID remains absent. It restores the former status without changing XP. If it cannot restore the record, dismiss Undo and instruct the user to reload.

After Undo expires, the initiating page retains no application-managed copy of the task text. The completion award remains and contains no task text.

## 7. Reward rules

### 7.1 Immutable rules V1

~~~ts
const REWARD_RULES_V1 = {
  rulesVersion: 1,
  todoBaseXp: 10,
  dailyLinkBonus: 5,
  comboMilestones: new Map([
    [5, 2],
    [10, 4],
    [15, 6],
    [20, 8],
  ]),
  curveAnchorLevel: 100,
  todosAtLevel100: 500,
  levelsPerRank: 5,
} as const;
~~~

Do not change these values in place after release. Every award stores <code>rulesVersion: 1</code>. Future balancing requires a new rules version and a compatibility specification.

### 7.2 First-completion-only invariant

A todo owns at most one completion award. Its first completion creates it. Reopening, re-completing, editing, and deleting never create another award and never remove or change the existing award.

Deleting a rewarded todo keeps its Lifetime XP. The award remains as anonymous history with an opaque todo ID and no task text.

Daily ordinals and LINK eligibility include awards for deleted todos. Deletion cannot reopen a milestone or erase yesterday's activity.

### 7.3 Calendar days

Derive <code>dayKey</code> from the device's local calendar at first completion:

~~~text
YYYY-MM-DD
~~~

Use local year, month, and day accessors. Do not slice an ISO UTC string. Use calendar arithmetic for the previous local day so daylight-saving changes do not become 24-hour assumptions.

Keep the original day key. Later timezone or clock changes do not rewrite history. If the device returns to a day that already has awards, continue that day's ordinal. V1 follows the device clock and has no anti-clock-manipulation logic.

### 7.4 LINK

If the immediately preceding local calendar day has at least one completion award, today's ordinal 1 receives 5 bonus XP. No other ordinal receives LINK.

Before today's first eligible completion, show <code>LINK READY</code> when yesterday qualifies. After awarding LINK, show <code>LINK ACTIVE</code> for the rest of that local day.

Do not display chain length, a streak count, a broken-streak message, or a penalty.

### 7.5 COMBO

COMBO applies only at exact milestones.

| Daily ordinal | Base XP | COMBO | Total before LINK |
|---:|---:|---:|---:|
| 1 through 4 | 10 | 0 | 10 |
| 5 | 10 | 2 | 12 |
| 6 through 9 | 10 | 0 | 10 |
| 10 | 10 | 4 | 14 |
| 11 through 14 | 10 | 0 | 10 |
| 15 | 10 | 6 | 16 |
| 16 through 19 | 10 | 0 | 10 |
| 20 | 10 | 8 | 18 |
| 21 and above | 10 | 0 | 10 |

LINK applies only to ordinal 1. COMBO applies only to ordinals 5, 10, 15, and 20. One V1 award can never contain both bonuses.

Show COMBO proximity only at counts 4, 9, 14, and 19:

~~~text
COMBO 4/5
COMBO 9/10
COMBO 14/15
COMBO 19/20
~~~

Do not show a permanent daily target or completion count. A milestone feedback message may include the COMBO result.

### 7.6 Accepted exploit boundary

This is a self-motivation tool, not a competitive economy.

- Duplicate task text is allowed. Each new todo ID can earn one award.
- Deleting and recreating the same text creates a new todo and may earn XP.
- Splitting work into small tasks remains possible.
- Device-clock and timezone changes may affect LINK and daily ordinals.
- Separate browser-local datasets may progress independently.

Do not add difficulty scoring, anti-cheat checks, text deduplication, streak penalties, or retroactive reward recalculation.

## 8. Progression, rank, and badge

### 8.1 XP curve

Lifetime XP is the sum of completion-award <code>totalXp</code> values. Awards are authoritative. Level and rank are derived.

~~~ts
const TODO_BASE_XP = 10;
const CURVE_ANCHOR_LEVEL = 100;
const TODOS_AT_LEVEL_100 = 500;

const XP_CURVE_EXPONENT =
  Math.log(TODOS_AT_LEVEL_100 - 1) /
  Math.log(CURVE_ANCHOR_LEVEL - 1);

function totalXpForLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 0) throw new RangeError();
  if (level === 0) return 0;
  return Math.round(
    TODO_BASE_XP * (1 + Math.pow(level - 1, XP_CURVE_EXPONENT)),
  );
}
~~~

Use exponential upper-bound discovery followed by binary search for <code>levelForTotalXp</code>. Do not iterate level by level. Clamp progress fractions to the inclusive range 0 through 1. Reject negative, fractional, non-finite, or unsafe integer inputs.

Reference thresholds:

| Level | Lifetime XP |
|---:|---:|
| 0 | 0 |
| 1 | 10 |
| 2 | 20 |
| 3 | 36 |
| 4 | 54 |
| 5 | 75 |
| 10 | 205 |
| 20 | 546 |
| 50 | 1,938 |
| 100 | 5,000 |
| 1,000 | 113,620 |

The 500 setting is a base-only pacing reference. LINK and COMBO lower the actual completion count.

### 8.2 HUD progress

The HUD displays XP within the current level:

~~~text
LV 014 · SERGEANT
12 / 27 XP
~~~

Compute the numerator as Lifetime XP minus the current-level threshold. Compute the denominator as the next threshold minus the current threshold. Show Lifetime XP in Progression details.

Format display numbers and dates with the device locale. Persist day keys, IDs, and rule keys in locale-independent forms.

### 8.3 Rank generation

A rank changes every five levels.

~~~ts
const BASE_RANKS = [
  "Cadet",
  "Trooper",
  "Sergeant",
  "Lieutenant",
  "Captain",
  "Major",
  "Colonel",
  "General",
  "Marshal",
] as const;

const PRESTIGE_ATOMS = [
  "Prime",
  "Vanguard",
  "Apex",
  "Ascendant",
  "Sovereign",
  "Stellar",
  "Omega",
  "Eternal",
] as const;
~~~

For <code>rankIndex = floor(level / 5)</code>, return a base rank while the index is in <code>BASE_RANKS</code>. After Marshal, encode the remaining rank index in bijective base 8, map its digits to <code>PRESTIGE_ATOMS</code>, and append Marshal.

Required samples:

~~~text
LV 000  Cadet
LV 005  Trooper
LV 040  Marshal
LV 045  Prime Marshal
LV 080  Eternal Marshal
LV 085  Prime-Prime Marshal
~~~

Never truncate the canonical title in state, Progression details, or accessible naming. The compact HUD may visually shorten a long title while retaining its full accessible name.

### 8.4 Procedural badge

The badge is the product's expressive visual element. Render it as deterministic inline SVG with <code>shape-rendering="crispEdges"</code> in a fixed <code>0 0 32 32</code> view box.

Each base rank has a distinct silhouette:

| Rank | Silhouette |
|---|---|
| Cadet | single bar or chevron |
| Trooper | twin chevron |
| Sergeant | stepped chevron |
| Lieutenant | narrow diamond |
| Captain | double diamond |
| Major | winged diamond |
| Colonel | shield and bars |
| General | star or wing form |
| Marshal | heavy crest |

<code>level % 5</code> adds zero through four pips. Prestige keeps the Marshal silhouette. A pure badge descriptor maps the first prestige atoms to stable modifiers and folds any remainder into a documented stable hash. The renderer contains no randomness and never grows the view box.

The same level must produce the same descriptor and SVG in every run. The badge is decorative next to visible rank text and uses <code>aria-hidden="true"</code>.

## 9. IndexedDB design

### 9.1 Database and authority

Use <code>idb</code> over IndexedDB.

~~~ts
const DB_NAME = "mecha-todo";
const DB_VERSION = 1;
~~~

The V1 database has three object stores:

~~~text
todos
completionAwards
meta
~~~

There is no day store, revocation ledger, soft-delete record, recovery snapshot, Quarantine store, synchronization log, or server-shaped schema.

### 9.2 Todo records

~~~ts
type TodoRecord = {
  id: string;
  text: string;
  status: "active" | "standby" | "completed";
  creationOrder: number;
  completionOrder: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};
~~~

Key path: <code>id</code>.

Indexes:

~~~text
by-status-creation-order    [status, creationOrder, id]
by-status-completion-order  [status, completionOrder, id]
by-creation-order           creationOrder, unique
by-completion-order         completionOrder, unique
~~~

The unique indexes enforce creation orders and non-null completion orders across statuses. IndexedDB does not index the null completion order on open todos. Ordering values and timestamps are nonnegative safe integers. Open todos have null completion fields. Completed todos have non-null completion fields and a matching completion award.

Deleting a todo physically removes this record.

### 9.3 Completion awards

~~~ts
type CompletionAwardRecord = {
  todoId: string;
  awardedAt: number;
  dayKey: string;
  dailyOrdinal: number;
  baseXp: 10;
  linkBonus: 0 | 5;
  comboBonus: 0 | 2 | 4 | 6 | 8;
  totalXp: number;
  rulesVersion: 1;
};
~~~

Key path: <code>todoId</code>.

Indexes:

~~~text
by-day-key      dayKey
by-awarded-at   awardedAt
by-day-ordinal  [dayKey, dailyOrdinal], unique
~~~

Award records are immutable after commit. An award may have no matching todo because deletion keeps anonymous XP history.

### 9.4 Meta records

Use named, separately validated records:

~~~text
core
derived-stats
~~~

<code>core</code> contains <code>createdAt</code>, <code>rulesVersion</code>, <code>nextCreationOrder</code>, and <code>nextCompletionOrder</code>. <code>derived-stats</code> may cache Lifetime XP and award count.

Counters and derived statistics can be rebuilt from authoritative records. Award records remain the source of truth. A missing or unsupported rules version is a local data problem.

### 9.5 Repository boundary

Components do not access IndexedDB directly. Expose typed operations through one repository.

~~~ts
interface AppRepository {
  initialize(): Promise<StartupResult>;
  getProjection(query?: ProjectionQuery): Promise<AppProjection>;
  addTodo(text: string): Promise<MutationResult>;
  editTodo(id: string, text: string): Promise<MutationResult>;
  toggleTodo(id: string): Promise<MutationResult>;
  deleteTodo(id: string): Promise<DeleteResult>;
  restoreDeletedTodo(snapshot: TodoRecord): Promise<MutationResult>;
  eraseLocalData(): Promise<void>;
}
~~~

Exact TypeScript names may change. The boundary and behavior may not.

## 10. Transaction contracts

Every repository mutation reads authoritative state inside its transaction and returns the complete committed result needed to refresh the initiating page.

### 10.1 Add

Validate text before opening a transaction. In one read-write transaction:

1. Derive current capacity from authoritative or rebuilt XP.
2. Count Active records.
3. Allocate a creation order.
4. Choose Active or Standby.
5. Insert the todo.
6. Update counters and commit.

### 10.2 Edit

In one read-write transaction:

1. Load the current todo.
2. Return a changed-in-another-tab error if it no longer exists.
3. Replace only its normalized text and updated timestamp.
4. Commit.

The last successful concurrent edit wins. The repository does not implement edit revisions.

### 10.3 First completion

In one read-write transaction over todos, completion awards, and meta:

1. Load the current todo.
2. Return a changed-in-another-tab error if it no longer exists.
3. Return the current state if it is already Completed.
4. Look up its completion award.
5. If no award exists, calculate the next daily ordinal and LINK eligibility from award indexes and insert the immutable award.
6. Mark the todo Completed and allocate its latest completion order.
7. Derive capacity from the new Lifetime XP.
8. Promote the oldest Standby records until capacity is full.
9. Update rebuildable statistics and commit.

The todo ID key prevents duplicate awards for the same todo. The unique day-ordinal index protects daily ordering.

If two different todos contend for the same day ordinal and a constraint abort occurs, retry the full transaction and recompute the next ordinal. Do not report that the losing todo was already credited.

### 10.4 Reopen and re-complete

Reopen sets status to Active and clears completion fields. It leaves the award and creation order unchanged and may exceed capacity.

Re-complete allocates a new completion order and timestamp but finds the existing award, adds zero XP, and returns <code>alreadyCredited: true</code>. It then performs normal Standby promotion.

### 10.5 Delete and Undo

Delete removes only the todo. It leaves its completion award untouched. If an Active todo was removed, fill available capacity before commit.

Return the former record to the initiating page for the five-second in-memory Undo. Restore only when the ID remains absent. A restore writes the former status and ordering fields without changing the award or reversing later promotions.

### 10.6 Erase local data

After confirmation, clear todos, completion awards, and meta in one transaction and recreate fresh core metadata. Clear the composer draft after commit. Return to level 0 and Cadet.

When IndexedDB cannot open, the confirmed error-screen erase action may delete and recreate the database. No automatic path may do this.

## 11. Startup, migration, and local-data errors

### 11.1 Startup sequence

~~~text
render static shell
open IndexedDB
run the version upgrade
validate core metadata
validate todos and completion awards
rebuild counters and derived statistics when needed
load the authoritative projection
~~~

Show <code>Opening local data...</code> while this runs. Do not flash an empty level-0 list before startup finishes.

Validation is strict. V1 does not quarantine, repair, skip, or silently discard malformed authoritative records. It also does not fall back to an in-memory list that appears persistent.

### 11.2 Schema migration

Database version 1 creates the three stores and their indexes. There is no speculative migration from schemas proposed in the IDEA document because no released legacy database exists.

Future versions must:

- use an ordered <code>oldVersion</code> switch;
- run changes in the IndexedDB version-change transaction;
- prefer additive changes;
- validate transformed records;
- abort on failure so the old database remains intact;
- close an older connection on <code>versionchange</code>;
- add a fixture and test for every released version still supported.

An upgrade blocked by another tab shows <code>Close MECHA//TODO in other tabs, then retry.</code> V1 does not synchronize the tabs.

### 11.3 Local-data error state

Database-open failure, migration failure, invalid core metadata, malformed todos or awards, unsafe XP, or unsupported rules produces one blocking state:

~~~text
Local data could not be opened.
Retry, or erase this browser's MECHA//TODO data and start again.
~~~

The state offers:

- Retry;
- Erase local data;
- a concise technical category that excludes task text.

Erasure opens a confirmation dialog. It is permanent and has no Undo. Do not offer raw data, file actions, partial record salvage, or a trusted progression display.

## 12. Client state and save errors

Solid state is a projection of IndexedDB plus transient interaction state. The repository commits every mutation immediately. There is no periodic save buffer.

Use optimistic state only where it improves response:

- A toggle paints the new checked state immediately.
- A failed write restores the prior row and focus context.
- Reward feedback waits for commit.
- Add and edit clear their drafts only after commit.
- Repeated actions on one pending row are disabled while other rows remain available.

A transient write failure shows a persistent, specific error with Retry when retry is safe. Never show success for a failed write.

No page listens for another tab's application mutations. A mutation that finds missing or incompatible state reports <code>List changed in another tab. Reload to continue.</code>

## 13. Interface and responsive layout

### 13.1 Information hierarchy

The single-page hierarchy is:

1. compact progression HUD;
2. Active Bay todos;
3. collapsed Standby and Completed sections;
4. task composer;
5. nonmodal reward and status feedback.

The progression badge is the distinctive visual element. Rows and controls remain restrained so progression does not compete with the work.

There is no onboarding carousel. The first completion teaches the loop by checking the todo, showing its XP, and updating the HUD.

### 13.2 Layout contract

All viewport modes use one left-aligned task column. Do not introduce dashboard columns or a desktop-only information hierarchy.

| Mode | CSS width | Release viewport | Layout |
|---|---:|---:|---|
| Mobile | below 768 px | 390 by 844 | full-width task surface |
| Tablet | 768 through 1023 px | 768 by 1024 | centered touch-friendly frame |
| Desktop | 1024 px and above | 1440 by 900 | centered denser frame |

The content column is at most 680 CSS pixels on tablet and desktop. CSS remains fluid between widths, but only the three named viewports block V1 release.

Mobile behavior:

- Use dynamic viewport height and safe-area insets.
- Keep the HUD sticky at the top and composer sticky at the bottom.
- Let the task list own the main scroll area.
- Use the full available width without horizontal overflow.

Tablet behavior:

- Center the same task column with touch-sized controls and larger gutters.
- Keep one scroll region and the same task order.
- Present Settings as a constrained dialog.

Desktop behavior:

- Keep the centered task column and reduce excess vertical spacing.
- Preserve 44-pixel controls despite the denser layout.
- Present Settings as a focus-managed modal.

A 280-code-point todo wraps without hiding its status or Delete controls. Long rank text stays within the HUD. Browser zoom and text enlargement must not create horizontal overflow at the tested viewports.

### 13.3 Progression interaction

The compact HUD shows:

- a 44 through 52 pixel badge;
- localized level;
- compact rank;
- current-level XP numerator, denominator, and progress bar;
- Active count and capacity;
- LINK or one-away COMBO state only when applicable.

Activating the badge or rank opens Progression details in Settings. It shows the larger badge, canonical rank, level, Lifetime XP, current-level progress, and rules version.

### 13.4 Settings

Settings contains:

1. Progression details.
2. A plain statement that the list exists only in this browser and cannot be transferred in V1.
3. App, database-schema, and reward-rules versions.
4. Erase local data.

On mobile, Settings fills the viewport and has a visible Back action. On tablet and desktop, it is a constrained dialog. Dialogs manage focus, close on <code>Escape</code>, and return focus to the opener.

### 13.5 Copy style

Use uppercase only for the product mark, rank display, terse system labels, and short status feedback. Task text, actions, errors, empty states, confirmations, and explanations use sentence case.

Action labels describe their result:

~~~text
Add task
Delete
Undo
Retry
Erase local data
~~~

Do not use shame, false urgency, or clinical claims. Empty Active Bay copy is <code>No active tasks. Add one when you are ready.</code>

## 14. Visual design

### 14.1 Design principle

Late-1990s mecha command displays inform the visual language. The procedural rank badge carries most of that character. Borders, labels, and color must communicate structure or state rather than decorate the page.

Do not add a decorative grid, gradients, glass effects, soft software-as-a-service shadows, large rounded cards, ornamental telemetry, or animation that does not explain a state change.

### 14.2 Color

| Token | Value | Use |
|---|---|---|
| <code>--color-bg</code> | <code>#09070D</code> | page background |
| <code>--color-surface</code> | <code>#15101D</code> | rows and HUD |
| <code>--color-surface-raised</code> | <code>#1E1629</code> | dialogs and menus |
| <code>--color-border</code> | <code>#4A355B</code> | structural lines |
| <code>--color-text</code> | <code>#F5F1F8</code> | primary text |
| <code>--color-muted</code> | <code>#B7A9C2</code> | secondary text |
| <code>--color-primary</code> | <code>#B86CFF</code> | focus, progress, and rank |
| <code>--color-status</code> | <code>#54FF73</code> | completion |
| <code>--color-warning</code> | <code>#FFC857</code> | warnings |
| <code>--color-danger</code> | <code>#FF6B7A</code> | deletion and failures |

Text colors must meet WCAG AA contrast on their intended background. The border color does not carry text or state by itself.

### 14.3 Typography

Bundle the Latin subset of JetBrains Mono Variable. Make no font request at runtime.

~~~css
font-family: "JetBrains Mono Variable", "Cascadia Code", ui-monospace, monospace;
~~~

| Role | Size and line height | Weight |
|---|---|---:|
| system label | 12 / 16 px | 650 |
| todo and body copy | 15 / 22 px | 450 |
| action | 14 / 20 px | 650 |
| HUD rank | 18 / 22 px | 700 |
| detailed rank | 24 / 30 px | 700 |

Use tabular numerals for XP, levels, and counts. Keep explanatory text under 72 characters per line. Preserve user-entered casing.

### 14.4 Motion

Motion only explains an action:

- a short checked-row hold;
- a short XP-bar interpolation after a committed award;
- one restrained HUD emphasis for a level or rank change.

Do not animate page entry, every row, hover states, or the background. No interaction waits for animation completion. Reduced-motion mode removes translation, pulsing, and interpolation.

## 15. Accessibility

Implement the WCAG 2.2 AA criteria that apply to the V1 interface. The three Chrome projects provide scoped automated evidence, not a claim of formal conformance across browsers, assistive technologies, or untested viewport sizes.

- Every action works with touch, mouse, and keyboard.
- Interactive targets are at least 44 by 44 CSS pixels.
- Focus uses a two-pixel high-contrast outline and is never removed.
- The status control has a task-aware accessible name.
- Delete includes the todo text in its accessible name.
- The progress element exposes its current value, minimum, maximum, level, and canonical rank.
- Compact rank output retains the full canonical accessible title.
- One polite live region announces the latest committed reward or save error.
- Color never carries status alone.
- Completed text remains readable.
- Settings and confirmation dialogs manage focus.
- Invalid fields connect their error with <code>aria-describedby</code> and set <code>aria-invalid</code>.
- Reduced-motion mode removes nonessential motion.
- Forced-colors mode preserves controls, borders, focus, and state labels.
- Text enlargement does not hide controls or create horizontal scrolling at the tested viewports.

Use semantic roles and accessible names as the main Playwright locators. Add test IDs only when no stable semantic locator exists.

## 16. Privacy, runtime, and deployment

### 16.1 Runtime privacy

The application makes no runtime request except same-origin application assets. It has no analytics, telemetry, crash reporter, remote font, advertising, API client, or third-party SDK.

Task text remains in IndexedDB or the unfinished local composer draft. Do not put it in URLs, document titles, routine console logs, error categories, or network requests.

### 16.2 Static deployment

Deploy the production build as static assets on Vercel. Do not add Functions, API routes, environment secrets, or a server database.

Use one stable HTTPS production origin. State before release that preview URLs, another hostname, another profile, and another device have separate data that V1 cannot transfer.

Serve hashed build assets with long-lived immutable caching. Serve the HTML entry point with revalidation so a normal reload receives the current build. Do not add a web app manifest or service worker.

Keep the existing favicon and touch icon when they match the current product mark. PWA-specific icon files have no V1 requirement.

Configure these response headers where Vercel permits them:

~~~text
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self'; img-src 'self' data:; font-src 'self'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
~~~

Document the smallest required Content Security Policy exception if the verified build needs one.

## 17. Technical stack

Use one verified dependency set and commit <code>package-lock.json</code>. The baseline below was registry-checked on 2026-09-14.

| Package | Baseline |
|---|---:|
| Node.js | <code>24.15.0</code> |
| npm | <code>11.12.1</code> |
| <code>solid-js</code> | <code>2.0.0-rc.8</code> |
| <code>@solidjs/web</code> | <code>2.0.0-rc.8</code> |
| <code>@solidjs/vite-plugin</code> | <code>3.0.0-next.43</code> |
| <code>vite</code> | <code>8.3.0</code> |
| <code>typescript</code> | <code>7.0.2</code> |
| <code>tailwindcss</code> | <code>4.3.3</code> |
| <code>@tailwindcss/vite</code> | <code>4.3.3</code> |
| <code>idb</code> | <code>8.0.3</code> |
| <code>valibot</code> | <code>1.5.0</code> |
| <code>@fontsource-variable/jetbrains-mono</code> | <code>5.3.0</code> |
| <code>@playwright/test</code> | <code>1.63.0</code> |
| <code>@axe-core/playwright</code> | <code>4.13.0</code> |

Solid 2 remains a prerelease line at the time of this plan. Before application work, run an empty production build, typecheck, and one Chrome smoke test with the exact group. If it fails, update the Solid compiler, runtime, web renderer, and Vite plugin as one compatible set and record the change in this file.

Do not add a component kit, router, state library, date library, gesture library, icon pack, animation library, object-relational mapper, server framework, unit-test runner, or PWA package for V1.

## 18. Proposed source layout

~~~text
src/
  app/
    App.tsx
    app-store.ts
  components/
    AddTodo.tsx
    LocalDataError.tsx
    ProgressHud.tsx
    RewardFeedback.tsx
    SettingsDialog.tsx
    TodoItem.tsx
    TodoSection.tsx
  config/
    product.ts
    rules-v1.ts
  domain/
    badge-descriptor.ts
    capacity.ts
    day-key.ts
    progression.ts
    ranks.ts
    rewards.ts
    todo-text.ts
  persistence/
    db.ts
    migrations.ts
    models.ts
    repository.ts
    schemas.ts
    startup.ts
  styles/
    app.css
  index.tsx
tests/
  domain/
    badge.spec.ts
    capacity.spec.ts
    progression.spec.ts
    ranks.spec.ts
    rewards.spec.ts
    todo-text.spec.ts
  e2e/
    accessibility.spec.ts
    local-data.spec.ts
    responsive.spec.ts
    todo-flow.spec.ts
  fixtures/
playwright.config.ts
vite.config.ts
~~~

Keep domain files free of Solid, DOM, IndexedDB, and current-time dependencies. Inject a clock wherever behavior depends on the current local day.

The Playwright runner may import pure domain modules directly. This keeps one test runner without forcing pure rules through a browser page.

## 19. Automated testing

### 19.1 Chrome projects

Use three release-blocking projects:

| Project | Viewport | Primary input |
|---|---:|---|
| <code>mobile-chrome</code> | 390 by 844 | touch and coarse pointer |
| <code>tablet-chrome</code> | 768 by 1024 | touch and coarse pointer |
| <code>desktop-chrome</code> | 1440 by 900 | mouse and keyboard |

Use the installed Google Chrome channel for all three. Do not add Firefox, WebKit, physical-device, or additional viewport release gates.

### 19.2 Domain cases

Test:

- whitespace normalization and code-point boundaries 0, 1, 280, and 281;
- duplicate todo text;
- every capacity boundary through the cap;
- Active and Standby placement, over-capacity reopen, and promotion;
- reward ordinals 1, 5, 6, 10, 11, 15, 16, 20, and 21;
- LINK across month, year, leap-day, and daylight-saving boundaries;
- proof that LINK and COMBO cannot coexist under rules V1;
- one award per todo and retained awards after deletion;
- level thresholds through level 1,000;
- every base rank and representative repeated prestige atoms;
- deterministic badge descriptors.

Do not add a production-excluded UI bridge or generate huge persisted histories to test extreme levels.

### 19.3 Browser cases

Test:

- fresh startup at level 0 Cadet;
- add, validation, duplicate text, draft restoration, and reload persistence;
- Active and Standby placement;
- collapsed Standby and Completed sections with 20-record paging;
- editing every status with Enter, blur, Escape, and validation errors;
- completion, reopen, already-credited completion, deletion, and five-second Undo;
- retained Lifetime XP after rewarded deletion;
- missing-record behavior when a second page removes a todo;
- same-todo and different-todo completion races without duplicate awards or ordinals;
- immediate checked state, committed reward feedback, and failure rollback;
- LINK, COMBO, level, rank, capacity, and promotion presentation;
- strict startup validation, retry, and confirmed local-data erasure;
- database upgrade blocking without live tab synchronization;
- Settings progression, browser-local data copy, versions, and erasure;
- 280-code-point wrapping, long rank handling, sticky regions, and scroll ownership;
- dynamic viewport sizing and sticky-region containment in the mobile project;
- no horizontal overflow in each project;
- keyboard order, focus return, reduced motion, forced colors, accessible names, live regions, and automated axe assertions;
- absence of third-party runtime requests.

Use deterministic clocks and timezones. Do not wait for real midnight.

### 19.4 Visual review

Keep reviewed screenshots for each of the three projects. Cover:

- an empty list;
- an ordinary list;
- expanded Standby and Completed sections;
- reward and rank-change feedback;
- a long todo and long rank;
- Settings;
- the local-data error and erasure confirmation.

The review checks hierarchy, wrapping, contrast, focus, sticky regions, and horizontal overflow. It does not create a pixel-perfect snapshot gate for every component.

## 20. Implementation sequence

Each phase ends with its relevant tests passing.

### Phase 1. Toolchain and shell

- Configure Vite, Solid 2, TypeScript, Tailwind, and Playwright.
- Pin the verified dependency set and commit the lockfile.
- Add product configuration and the bundled font.
- Render one accessible static shell.
- Prove development build, production build, typecheck, and one Chrome smoke test.

### Phase 2. Domain rules

- Implement text normalization, day keys, rewards, progression, capacity, ranks, and badge descriptors.
- Add direct Playwright-runner tests for the boundary tables.
- Freeze rules V1 in one config module.

### Phase 3. Browser-local persistence

- Create the three-store IndexedDB schema and strict Valibot schemas.
- Implement repository queries and atomic mutations.
- Implement fresh startup, V1 upgrade handling, strict validation, simple errors, and confirmed erasure.
- Test racing transactions without adding live tab synchronization.

### Phase 4. Todo interface

- Render the authoritative startup projection.
- Build the composer, Active Bay, paged Standby and Completed sections, inline editing, completion, reopen, delete, and Undo.
- Add optimistic checked state and failure rollback.

### Phase 5. Progression interface

- Connect committed awards to the HUD, LINK, COMBO, level, rank, capacity, and promotion.
- Render deterministic badges.
- Add Progression details and the small Settings dialog.

### Phase 6. Responsive design and accessibility

- Apply the visual tokens and three layout modes.
- Complete long-content wrapping, sticky regions, keyboard behavior, focus management, reduced motion, and forced colors.
- Review screenshots at the three release viewports.

### Phase 7. Release and deployment

- Run all three Chrome projects.
- Run the production privacy and network checks.
- Deploy static assets to the stable production origin.
- Verify response headers, ordinary asset caching, browser-local persistence, and the production smoke flow.

## 21. V1 acceptance criteria

### Todo behavior

- [ ] A fresh dataset shows level 0 Cadet and an empty Active Bay.
- [ ] A valid todo saves in one action and survives reload.
- [ ] Text normalization and the 280-code-point limit match section 5.1.
- [ ] Active, Standby, and Completed ordering remains stable across clock changes.
- [ ] Capacity affects new placement but never blocks reopen.
- [ ] Opening capacity promotes the oldest Standby todos.
- [ ] Editing any status has no XP or ordering side effect.
- [ ] Every task action has a visible touch, mouse, and keyboard path.
- [ ] Delete commits immediately, offers a five-second in-memory Undo, and removes the todo without revoking XP.

### Rewards and progression

- [ ] First completion creates exactly one immutable award.
- [ ] Reopen and re-complete create no additional XP.
- [ ] Deletion never changes Lifetime XP.
- [ ] LINK and milestone-only COMBO match the exact rules.
- [ ] Deleted awards continue to count for ordinals, LINK, and progression.
- [ ] Level thresholds and procedural ranks match the reference cases.
- [ ] Current-level XP appears in the HUD and Lifetime XP appears in Progression details.
- [ ] Every tested rank produces a deterministic badge and accessible canonical title.

### Browser-local data

- [ ] IndexedDB is authoritative and task data never enters a network request.
- [ ] Todos, awards, ordering, and XP survive a normal reload.
- [ ] Transaction constraints prevent duplicate awards and daily ordinals.
- [ ] Another tab's removal produces a reload instruction instead of recreating stale data.
- [ ] Invalid or inaccessible data produces the blocking local-data error state.
- [ ] No automatic path deletes, silently repairs, or replaces the database.
- [ ] Confirmed erasure returns the app to level 0 and clears the composer draft.
- [ ] Settings states that data exists only in the current browser and cannot be transferred in V1.

### Responsive interface and accessibility

- [ ] The mobile, tablet, and desktop Chrome projects pass at 390 by 844, 768 by 1024, and 1440 by 900.
- [ ] All three use the same task-first, one-column information hierarchy.
- [ ] Mobile uses dynamic viewport sizing and keeps both sticky regions inside the tested viewport.
- [ ] A 280-code-point todo and a long rank do not hide actions or create horizontal overflow.
- [ ] Settings uses a full-screen mobile presentation and constrained tablet and desktop dialogs.
- [ ] WCAG 2.2 AA-aligned checks, visible focus, reduced motion, forced colors, text enlargement, and 44-pixel targets pass.
- [ ] Reward feedback never blocks the next task action.

### Privacy and release

- [ ] Production makes no third-party runtime request and sends no task content off device.
- [ ] Production has no manifest, service worker, install code, offline promise, file-data workflow, or synchronization protocol.
- [ ] The three required Chrome projects pass.
- [ ] Static deployment uses the selected stable HTTPS origin and the documented security headers.
- [ ] Production smoke testing proves the main todo flow and browser-local persistence.

## 22. Explicit V1 decisions

These decisions must not drift back into the implementation:

| Previous assumption or open question | V1 decision |
|---|---|
| The product is an installable offline-ready PWA | V1 is a responsive web app with no PWA or offline contract |
| Users can move data with JSON files | V1 has no import, export, backup, restore, rollback, or raw file flow |
| Browser storage requests improve durability | V1 accepts browser-local loss risk and has no persistence-permission UI |
| Corrupt records enter Quarantine or Recovery Mode | Any untrusted authoritative data produces one Retry or Erase blocking state |
| Tabs synchronize through revisions and BroadcastChannel | V1 has no live tab synchronization; transactions protect only stored invariants |
| Mobile rows provide swipe shortcuts | Every action uses a visible control; V1 has no swipe gestures |
| Several browsers and physical devices block release | Only three Google Chrome viewport projects block V1 |
| Phone testing covers two nearby widths | V1 tests one representative mobile, tablet, and desktop viewport |
| Extreme levels require a production-excluded UI bridge | Domain tests cover representative safe values without a test-only production seam |
| Release requires huge-dataset physical-device timing | V1 checks algorithms and paging without a large manual performance run |
| Reward feedback needs fixed aggregation windows | V1 shows one committed result and leaves short display timing to the implementation |
| Deleting a rewarded todo revokes XP | Deletion keeps its anonymous immutable award and XP |
| Tier COMBO rewards every todo after a boundary | COMBO rewards only exact ordinals 5, 10, 15, and 20 |
| LINK and COMBO may appear on one award | Rules V1 makes that combination impossible |
| Reopening under a full Active Bay is undefined | Reopen always enters Active and may exceed capacity |
| Completed and Standby histories render in full | Each section loads 20 records at a time |
| Custom fonts may load remotely | JetBrains Mono Variable is bundled |

## 23. Future changes

Login and Turso require a new specification. The intended direction is:

- Turso becomes the authoritative dataset after authentication.
- A future explicit adoption flow decides whether and how to copy an existing browser-local list into an account.
- V1 does not add a Turso adapter, sync queue, tombstones, server revisions, or speculative conflict rules.
- Server-side retention and backup are separate future decisions. Login and synchronization alone do not define them.

The future adoption specification must define duplicate IDs, conflicting account data, immutable completion awards, local-data deletion after adoption, and failure rollback before it moves any V1 dataset.

If reward tuning changes, preserve V1 awards exactly and introduce a new rules version.

If the display name changes, update product configuration and visible assets. Do not rename the browser database merely for branding.
