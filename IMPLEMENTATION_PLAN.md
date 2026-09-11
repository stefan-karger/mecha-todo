# MECHA//TODO implementation plan

Status: Approved specification after the grilling phase on 2026-09-11.

Source: `docs/MECHA_TODO_IDEA_V4.md` plus the decisions made during the specification interview.

This document is the implementation contract for V1. If it conflicts with the IDEA document, this document wins. It resolves the IDEA's open questions and known contradictions. An implementation change that alters a product rule in this file requires an explicit product decision. Technical details may change only when they preserve the stated behavior and acceptance criteria.

This plan does not authorize features outside V1.

## 1. Product contract

`MECHA//TODO` is the working display name. It may change later, so visible naming must come from one product configuration module.

```ts
export const PRODUCT_NAME = "MECHA//TODO";
export const PRODUCT_SLUG = "mecha-todo";
```

Use the neutral slug for package names, database names, local-storage keys, broadcast-channel names, backup format identifiers, and filenames. Do not put the display name into schema or migration semantics.

The product is a personal, local-first todo list with a thin progression layer:

```text
capture a real task
complete it
receive immediate XP once
see progress
leave the app
```

The task list remains the main content. Progression supports task completion and must not become a second system that needs maintenance.

The product may describe its interaction design as ADHD-friendly or ADHD-oriented. It must not claim to treat ADHD, change dopamine, or provide a clinical benefit.

## 2. Users, devices, and support boundary

V1 has one local user per browser origin and profile. It has no account and no sync.

Each device, browser, browser profile, and origin has its own dataset. Two tabs and an installed PWA in the same Chrome profile and origin share one IndexedDB database. Chrome and Firefox on the same computer do not share data. Two computers do not share data. This separation is intended behavior, not a sync failure.

JSON backups are portable. A user may export one installation and replace another installation's dataset with it. The installations diverge again after import.

### Supported environments

| Environment | Contract |
|---|---|
| Google Chrome on the Pixel 10 Pro | Supported phone target, both normal browser and installed PWA |
| Google Chrome on Windows 11 | Supported desktop target |
| Firefox on Windows 11 | Best effort, nonblocking |
| Safari and WebKit browsers | Best effort, outside the V1 acceptance gate |
| Other browsers | Unsupported unless they happen to work |

Chrome-only support means release-blocking automated browser tests run on Chrome or Chromium. Firefox smoke checks may report defects, but they do not block V1. Playwright mobile emulation checks layout and pointer behavior. It does not replace the manual Pixel test pass.

## 3. V1 scope

V1 includes:

- adding, editing, completing, reopening, and deleting one-line tasks;
- Active Bay placement and a collapsed Standby queue;
- completed-task history with incremental loading;
- leading status controls, keyboard actions, and swipe actions;
- first-completion-only XP;
- a daily LINK bonus and milestone-only COMBO bonuses;
- levels, procedural ranks, and deterministic procedural pixel badges;
- IndexedDB persistence, schema migrations, validation, quarantine, and Recovery Mode;
- normal web use, installable PWA behavior, and an offline application shell;
- persistent-storage status and a user-triggered retry;
- plaintext JSON backup export, strict replace import, and one-step restore rollback;
- same-profile, cross-tab consistency;
- responsive phone, tablet, and desktop layouts;
- English interface copy with device-locale date and number formatting;
- accessibility and reduced-motion behavior;
- Playwright tests for domain code and browser behavior.

V1 does not include:

- accounts, authentication, a backend, cloud storage, or device sync;
- due dates, reminders, recurrence, projects, tags, priorities, subtasks, notes, calendars, or manual sorting;
- AI task decomposition;
- currency, shops, inventory, loot, achievements, leaderboards, social features, health, damage, or streak punishment;
- notifications, audio, or haptics;
- analytics, telemetry, crash reporting, remote fonts, advertising, or third-party runtime requests;
- user-configurable progression rules;
- a native wrapper;
- non-English interface copy in V1.

## 4. Domain vocabulary

Use these terms consistently in code, tests, and UI copy:

- A **todo** is one task record. UI labels may call it a directive, but domain code uses `todo`.
- **Active** means visible in Active Bay.
- **Standby** means open but outside the current Active Bay focus set.
- **Completed** means currently checked. It does not mean the todo can earn XP again.
- A **completion award** is the single immutable XP award attached to a todo's first completion.
- **Lifetime XP** is the sum of every completion award, including awards whose todo was later deleted.
- **LINK** is the bonus on today's first eligible completion when yesterday had an award.
- **COMBO** is a bonus on one of four exact daily completion milestones.
- **Rules version** identifies the immutable reward and progression contract used by an award.
- **Recovery snapshot** means the single in-browser pre-import rollback copy. It is not an external backup.
- **Quarantine** contains malformed noncritical records removed from live state.
- **Recovery Mode** is the read-only state used when XP integrity, rules compatibility, or database access cannot be trusted.

## 5. Todo rules

### 5.1 Text validation

A todo contains one line of text.

On save, normalize the value as follows:

1. Replace every run of JavaScript Unicode whitespace with one ASCII space.
2. Trim leading and trailing whitespace.
3. Count Unicode code points with `Array.from(value).length`.
4. Accept 1 through 280 code points.

Do not truncate. Preserve casing and all non-whitespace characters. Do not apply Unicode normalization beyond whitespace handling. Duplicate text is allowed.

An empty or overlong value keeps the composer or row in edit mode and shows a specific inline error. The database is not changed.

Use `crypto.randomUUID()` for todo IDs. Treat IDs as opaque UUIDs everywhere else.

### 5.2 Adding and editing

The composer has one text input and one Add action.

- `Enter` and the mobile keyboard's Done action save.
- A successful desktop add clears the composer and keeps focus in it.
- A successful add on a coarse-pointer device clears the composer and dismisses the keyboard.
- A failed save keeps the text and focus context.
- If the new todo enters Standby, show `ADDED TO STANDBY`.
- Save the composer draft to a versioned `localStorage` key as the user types.
- Restore that draft only in the same origin and browser profile.
- Clear it only after a successful add or full data erasure.
- A local-storage failure must not prevent normal todo use.

The user can edit Active, Standby, and Completed todos inline by activating the task text.

- `Enter` and mobile Done save an edit.
- Blur attempts to save an edit.
- `Escape` cancels on a keyboard device.
- Invalid text leaves the row in edit mode with its draft intact.
- Editing never changes XP, status, creation order, or completion order.
- A stale cross-tab edit is rejected. Keep the draft and show `TASK CHANGED IN ANOTHER WINDOW`.

After a stale edit rejection, reload the row's current revision behind the editor. A later Save is an intentional edit against that new revision. Cancel discards the draft and shows the current record.

### 5.3 Status and ordering

Todos have exactly one status:

```ts
type TodoStatus = "active" | "standby" | "completed";
```

Active and Standby todos sort by immutable creation order, oldest first. Reopening a todo keeps its original creation order. Completed todos sort by their most recent completion order, newest first. IDs break any remaining tie.

Do not rely on wall-clock timestamps for stable ordering. Allocate monotonic `creationOrder` and `completionOrder` integers in the same transaction as the mutation. Timestamps remain useful for display and backup history, but device-clock changes must not reorder records.

Completed and Standby sections start collapsed on every fresh document launch. Disclosure state lives only in Solid state for the current document session. It is not backed up or synchronized. A changed collapsed section may pulse its count, but it must not open itself.

When expanded:

- Completed initially loads the newest 20 records.
- `Show 20 older` adds the next 20.
- Standby initially loads the oldest 20 records.
- `Show 20 more` adds the next 20.
- All records remain in IndexedDB until the user deletes them or erases all data.

### 5.4 Active Bay capacity

Capacity is a focus target, not a hard invariant.

```ts
activeCapacity(level) = Math.min(8 + Math.floor(level / 5), 16)
```

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

- If `activeCount < capacity`, add the new todo as Active.
- Otherwise add it as Standby.

Reopening a Completed todo always makes it Active. This may put Active Bay above capacity. Do not reject the reopen and do not demote another Active todo.

Whenever an Active todo completes or is deleted, promote the oldest Standby todos until Active reaches the current capacity. Promote none while Active is still at or above capacity.

A completion may increase the rank and capacity. After applying its award, fill every newly available slot in the same transaction. Completing a Standby todo also allows this fill step. A promotion never changes creation order.

Undoing a deletion restores the todo's former status even if that creates an over-capacity Active Bay. Do not demote a Standby todo that was promoted after the deletion.

## 6. Task interactions and feedback

Every row has a leading status control with a minimum 44 by 44 CSS pixel target.

- Activating it on Active or Standby completes the todo.
- Activating it on Completed reopens the todo.
- Activating task text enters inline edit mode.
- A trailing, keyboard-accessible Delete action is always available without a gesture. It may become visually prominent on hover or focus.

Swipe is an enhancement:

- Swipe right toggles completion or reopen.
- Swipe left reveals Delete.
- A full swipe never deletes.
- Only one row may remain revealed.
- Scrolling, `Escape`, or interacting elsewhere closes a revealed action.

Implement swipes with Pointer Events and `touch-action: pan-y`. Treat the movement as horizontal only after it reaches 12 CSS pixels and is at least 1.25 times the vertical movement. Commit a right-swipe toggle or left-swipe reveal at 48 CSS pixels. Cancel when vertical intent wins. Browser edge navigation keeps priority.

### 6.1 Completion timing

The row checks or strikes immediately. Persist the transaction at once. Keep the checked row in place until both conditions are true:

- the transaction committed; and
- 600 ms passed after the user's action.

Then move it to Completed and reveal any Standby promotions. If the user reopens the row during the hold, cancel the move timer. If the write fails, restore the prior UI state and show a save error. Never show XP before the transaction commits.

Reduced-motion mode removes translations, slides, and pulses. The static checked hold may remain because it communicates the state change.

### 6.2 Reopen, re-complete, and delete copy

Use these nonblocking status messages:

```text
TASK REOPENED · XP RETAINED
TASK COMPLETE · ALREADY CREDITED
TASK DELETED · XP RETAINED
```

The last message applies to a rewarded todo. A never-rewarded deletion uses `TASK DELETED`.

Deleting commits immediately and shows one nonmodal Undo action for five seconds. Keep the deleted `TodoRecord` only in memory during that window. Closing, reloading, or losing the document discards Undo. An undo succeeds only if the todo ID is still absent and no incompatible dataset replacement occurred. Otherwise dismiss it and explain that the list changed in another window.

Deleting a todo removes it from the `todos` store and purges all app-managed recovery snapshots. Its completion award, if one exists, remains. Undo restores the todo record with a new revision; it does not modify the award.

Deletion is application-level erasure, not forensic erasure. The app cannot remove copies in previously exported files, browser backups, filesystem remnants, or device backups. No task text remains in live app data or app-managed recovery snapshots after the Undo window expires.

## 7. Reward rules

### 7.1 Immutable rules V1

```ts
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
```

Do not change these values in place after release. Every award stores `rulesVersion: 1`. Future balancing requires a new rules version and an explicit compatibility or migration design.

### 7.2 First-completion-only invariant

A todo may own at most one completion award. Its first completion creates it. Reopening, re-completing, editing, and deleting never create another award and never remove or change the existing award.

Deleting a rewarded todo retains its lifetime XP. The award remains as anonymous history with an opaque todo ID. It contains no task text.

Daily ordinals and LINK eligibility include awards for deleted todos. Deletion cannot reopen a milestone or erase yesterday's activity.

### 7.3 Calendar days

Derive `dayKey` from the device's local calendar at the instant of first completion:

```text
YYYY-MM-DD
```

Use local year, month, and day accessors. Never derive it by slicing an ISO UTC string. Use calendar arithmetic to find the previous local day so daylight-saving transitions do not become 24-hour assumptions.

Store the original `dayKey` forever. A later timezone or clock change does not rewrite history. If the device returns to a day that already has awards, continue that day's next ordinal. The app follows the device clock and has no anti-clock-manipulation logic.

### 7.4 LINK

If the immediately preceding local calendar day has at least one completion award, today's ordinal 1 receives `+5 XP`. No other ordinal receives LINK.

Before today's first eligible completion, show `LINK READY` only when yesterday qualifies. After awarding LINK, show `LINK ACTIVE` for the rest of that local day. Do not display chain length, a streak count, a broken-streak message, or a penalty.

### 7.5 COMBO

COMBO is milestone-only. It is not an ongoing tier.

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

Because LINK applies only to ordinal 1 and COMBO applies only to ordinals 5, 10, 15, and 20, one award can never contain both bonuses in rules V1.

Show COMBO proximity only at counts 4, 9, 14, and 19:

```text
COMBO 4/5
COMBO 9/10
COMBO 14/15
COMBO 19/20
```

Do not show a permanent daily completion target or count. On a milestone, include the COMBO result as the secondary reward line.

### 7.6 Rapid reward aggregation

Use one reward-feedback slot. Show the first committed award immediately and open a fixed 400 ms aggregation window. Further awards committed in that window update the same feedback. Do not extend the window indefinitely.

Example:

```text
+32 XP · 3 tasks
COMBO 5/5
```

Keep ordinary feedback visible for at least 700 ms after the last included commit. A level, rank, LINK, or COMBO event may remain for up to 1,400 ms. It never blocks interaction.

Use one polite live region. Announce the aggregate when the 400 ms window closes instead of announcing every rapid completion. A milestone may be included in the same announcement.

### 7.7 Accepted exploit boundary

This is a self-motivation tool, not a competitive economy.

- Duplicate task text is allowed. Each new todo ID can receive one award.
- Deleting and recreating the same text creates a new todo and may earn XP.
- Splitting work into small tasks remains possible. Milestone-only COMBO limits its payoff.
- Device-clock and timezone changes may affect LINK and day ordinals.
- A user may replace local state with an older valid backup.
- Separate devices may progress independently.

Do not add difficulty scoring, anti-cheat checks, task-text deduplication, streak penalties, or retroactive reward recalculation.

## 8. Progression and rank

### 8.1 XP curve

Lifetime XP is the sum of completion award `totalXp` values. Awards are authoritative. Level and rank are derived.

```ts
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
```

The initial exponent is approximately `1.3520008831912302`.

Use exponential upper-bound discovery followed by binary search for `levelForTotalXp`. Never iterate level by level. Clamp progress fractions to the inclusive range 0 through 1.

Only safe, nonnegative integers are supported for XP and level inputs. The maximum supported lifetime XP is `Number.MAX_SAFE_INTEGER`. The progression function remains monotonic through the corresponding approximate level `115,101,208,233`. Reject or enter Recovery Mode for persisted totals outside the safe range.

Correct reference thresholds are:

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
| 10,000 | 2,558,271 |
| 1,000,000 | 1,294,209,893 |

The `500` setting is a base-only pacing reference. LINK and COMBO make the actual number of completions lower.

### 8.2 HUD progress

The HUD displays XP within the current level, not lifetime XP:

```text
LV 014 · SERGEANT
12 / 27 XP
```

Compute the numerator as `totalXp - currentLevelThreshold` and the denominator as `nextLevelThreshold - currentLevelThreshold`. Show lifetime XP in Settings and in accessible progression details.

Format display numbers and dates with the device locale. Keep persisted day keys, backup fields, IDs, and rule keys locale-independent.

### 8.3 Rank generation

A rank changes every five levels.

```ts
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
```

For `rankIndex = floor(level / 5)`, return the base rank while the index is within `BASE_RANKS`. After Marshal, encode `rankIndex - BASE_RANKS.length + 1` in bijective base 8. Subtract one before each modulo operation, map digits 0 through 7 to the atoms above, reverse the digits, join them with hyphens, then append `Marshal`.

Required samples:

```text
LV 000       Cadet
LV 005       Trooper
LV 040       Marshal
LV 045       Prime Marshal
LV 080       Eternal Marshal
LV 085       Prime-Prime Marshal
LV 010000    Apex-Stellar-Eternal-Eternal Marshal
LV 1000000   Sovereign-Eternal-Stellar-Ascendant-Stellar-Eternal Marshal
```

The canonical title is never truncated in state, backup derivation, accessible naming, or the Progression panel. On a narrow HUD, try the full title on at most two lines. If it overflows, render the first atom, an ellipsis, the last atom, and `Marshal` on the second line. The accessible name still contains the canonical title.

### 8.4 Procedural badge

The rank badge is a required V1 feature. Render it as deterministic inline SVG with `shape-rendering="crispEdges"` in a fixed `0 0 32 32` view box. Its compact HUD size is 48 CSS pixels, with a permitted responsive range of 44 through 52 pixels. The larger Progression panel may use 96 pixels.

Each base rank has the silhouette family defined in the IDEA:

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

`level % 5` adds zero through four pips. Prestige uses the Marshal silhouette. The first four prestige atom occurrences become slot-aware direct modifiers, so repeated atoms remain visible. Map atoms to the modifier concepts from the IDEA. Hash all remaining atoms with a documented 32-bit FNV-1a implementation. Use the hash and remaining atom count to select pixels in a fixed auxiliary glyph grid, a border pattern, and accent positions. Never grow the view box.

| Atom | Direct modifier |
|---|---|
| Prime | center highlight |
| Vanguard | forward side fins |
| Apex | upper spike |
| Ascendant | vertical extension |
| Sovereign | crown pixels |
| Stellar | star pixels |
| Omega | enclosing ring |
| Eternal | mirrored outer frame |

The pure badge descriptor contains the base silhouette, pips, direct modifiers, atom count, and remainder hash. The renderer contains no randomness. The same level must produce the same descriptor and SVG in every run. The badge is decorative next to visible rank text and uses `aria-hidden="true"`.

## 9. IndexedDB design

### 9.1 Database and authority

Use `idb` over IndexedDB.

```ts
const DB_NAME = "mecha-todo";
const DB_VERSION = 1;
```

IndexedDB is authoritative for todos and awards. Service-worker caches never store task data. `localStorage` stores only the composer draft. Session storage may mark one document session for install-prompt launch counting.

The initial database has these object stores:

```text
todos
completionAwards
meta
quarantine
recoverySnapshots
```

There is no `days` store. Daily counts and LINK eligibility derive from indexed completion awards. There is no generic revocation ledger. Deletion does not revoke XP.

### 9.2 Todo records

```ts
type TodoRecord = {
  id: string;
  text: string;
  status: "active" | "standby" | "completed";
  creationOrder: number;
  completionOrder: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  revision: number;
};
```

Key path: `id`.

Indexes:

```text
by-status-creation-order     [status, creationOrder, id]
by-status-completion-order   [status, completionOrder, id]
```

`creationOrder`, non-null `completionOrder`, timestamps, and revisions are nonnegative safe integers. Creation orders are unique. Non-null completion orders are unique. An open todo has null completion fields. A Completed todo has non-null completion fields and must have a matching completion award.

`revision` is the value of global `stateRevision` from the transaction that most recently changed that todo. Import assigns the import transaction's new global revision to every imported todo. Revisions are local concurrency metadata and never appear in a portable backup.

Deleting a todo physically deletes this record. Do not use `deletedAt` or a soft-delete flag.

### 9.3 Completion awards

```ts
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
```

Key path: `todoId`. This enforces one award per todo without an invalid unique index shared by award and revocation rows.

Indexes:

```text
by-day-key        dayKey
by-awarded-at     awardedAt
by-day-ordinal    [dayKey, dailyOrdinal], unique
```

Award records are immutable after commit. An award may have no matching todo because task deletion keeps anonymous XP history. It never contains task text.

### 9.4 Meta records

Use named, separately validated meta values rather than one untyped settings blob. At minimum store:

```text
core
derived-stats
durability-state
install-prompt-state
last-export-state
quarantine-notice-state
```

`core` contains `createdAt`, `installId`, `datasetGeneration`, `rulesVersion`, `stateRevision`, `nextCreationOrder`, and `nextCompletionOrder`. `datasetGeneration` is an opaque UUID that changes after import, import rollback, or full erasure. Counters and derived statistics can be rebuilt from records. An unsupported rules version is critical and cannot be guessed.

If a counter or derived statistic is malformed, quarantine the bad value and rebuild it. If `installId` is malformed, quarantine it and generate a replacement. If `datasetGeneration` is malformed, quarantine it, generate a replacement, and force every open document to reload its projection. A missing or unsupported `rulesVersion` enters Recovery Mode.

`derived-stats` may cache total XP and award count for fast reads. It is never authoritative. Rebuild it during startup validation, import, and any detected mismatch. Award records remain the source of truth.

`installId`, persistence state, install-prompt state, launch count, last-export time, and quarantine-notice state are local installation metadata. Backups do not contain them.

### 9.5 Quarantine records

```ts
type QuarantineRecord = {
  id: string;
  sourceStore: "todos" | "meta";
  sourceKey: string;
  detectedAt: number;
  reasonCode: string;
  raw: unknown;
};
```

Keep the original structured-clone value. Do not put it back into live state without a future explicit recovery design.

Malformed todo records and noncritical meta/settings records move to Quarantine in a transaction. Invalid settings reset to documented defaults. If quarantining a broken Active todo opens capacity, promote Standby records using the normal ordering rule.

Malformed awards, unsupported reward rules, unsafe XP totals, failed database opening, failed migration, or a failure to preserve a malformed record enter Recovery Mode. Do not quarantine an award and continue with changed XP.

### 9.6 Recovery snapshot

The `recoverySnapshots` store contains at most one record under key `pre-import`. It holds a validated internal copy of the current todos and completion awards plus its creation time. It contains no draft or install metadata.

An import replaces any older snapshot with the state that exists immediately before that import. `UNDO LAST RESTORE` is available in Settings until:

- the user invokes it once; or
- any todo add, edit, complete, reopen, delete, or delete-undo occurs.

Any task deletion purges the snapshot. Undoing that deletion does not recreate it.

### 9.7 Repository boundary

Components do not call IndexedDB directly. Expose typed commands through one `IndexedDbRepository` and return complete mutation results.

```ts
interface AppRepository {
  initialize(): Promise<StartupResult>;
  getProjection(query?: ProjectionQuery): Promise<AppProjection>;
  addTodo(text: string): Promise<MutationResult>;
  editTodo(id: string, expectedRevision: number, text: string): Promise<MutationResult>;
  toggleTodo(id: string, expectedRevision: number): Promise<MutationResult>;
  deleteTodo(id: string, expectedRevision: number): Promise<DeleteResult>;
  restoreDeletedTodo(snapshot: TodoRecord, deletionRevision: number): Promise<MutationResult>;
  exportBackup(): Promise<BackupFile>;
  inspectBackup(input: unknown): Promise<BackupPreview>;
  importBackup(input: unknown): Promise<ImportResult>;
  undoLastImport(): Promise<ImportResult>;
  exportQuarantine(): Promise<File>;
  discardQuarantine(): Promise<void>;
  eraseAllData(confirmation: string): Promise<void>;
}
```

Exact TypeScript names may change, but the boundary and behavior must remain.

## 10. Transaction contracts

Every successful task mutation increments global `stateRevision`. Set the revision of every todo changed by that transaction, including promoted todos, to the new global revision. It also invalidates the pre-import snapshot. Allocate sequence counters inside the same transaction.

### 10.1 Add

In one read-write transaction over `todos`, `completionAwards`, `meta`, and `recoverySnapshots`:

1. Normalize and validate text before opening the transaction.
2. Derive current capacity from cached or recomputed authoritative XP.
3. Count Active records.
4. Allocate a creation order.
5. Select Active or Standby.
6. Insert revision 1.
7. clear the pre-import snapshot;
8. increment `stateRevision` and commit.

Request persistent storage once after the first successful valid add, outside the database transaction.

### 10.2 First completion

In one read-write transaction over `todos`, `completionAwards`, `meta`, and `recoverySnapshots`:

1. Load the current todo and verify `expectedRevision`.
2. If it is already Completed, return the current state without a reward.
3. Check `completionAwards` by todo ID.
4. If no award exists, derive local `dayKey`, query the day's highest ordinal, query yesterday, compute the exact reward, and insert the immutable award.
5. Mark the todo Completed and allocate its latest completion order.
6. Recompute capacity from the new lifetime XP.
7. Promote the oldest Standby records until capacity is full.
8. Update rebuildable statistics, clear the pre-import snapshot, increment `stateRevision`, and commit.

The unique award key and unique day-ordinal index are final guards against simultaneous completions in multiple windows. Retry a transaction only for a known transient IndexedDB abort. On a uniqueness race, reload the committed award and return `alreadyCredited` rather than producing another reward.

### 10.3 Reopen and re-complete

Reopen sets status to Active and clears completion fields. It leaves the award unchanged and may exceed capacity.

Re-complete allocates a new completion order and timestamp but finds the existing award, adds zero XP, and returns `alreadyCredited: true`. It then performs normal Standby promotion because an Active slot may have opened.

### 10.4 Delete

Delete removes only the todo. It leaves `completionAwards` untouched. If an Active row was removed, fill available capacity. Clear the recovery snapshot and commit before showing Undo.

The in-memory Undo snapshot includes the full former todo record and the current `datasetGeneration`. Restore only when the ID remains absent and the dataset generation still matches. Unrelated task mutations during the five-second window do not disable Undo. Allocate a new record revision and global revision during restore.

### 10.5 Import and rollback

Import validation and preview occur before any write. The confirmed write uses one transaction covering all application stores that change:

1. replace `pre-import` with the current validated dataset;
2. clear and replace `todos`;
3. clear and replace `completionAwards`;
4. allocate a new global revision, assign it to every imported todo, rebuild counters and derived statistics, and create a new dataset generation;
5. retain local install, persistence, draft, last-export, and quarantine state;
6. increment `stateRevision` and commit.

Quarantine remains separate and is never silently discarded by import. The preview must state when local quarantined records will remain.

Undo Last Restore performs the inverse replacement in one transaction, assigns a new global revision to every restored todo, creates another dataset generation, and deletes the snapshot. It is one-shot.

## 11. Concurrency and browser lifecycle

Use `BroadcastChannel("mecha-todo:v1")` for same-origin, same-profile notifications. Messages contain only the install ID, dataset generation, new global revision, mutation kind, and affected IDs. Do not broadcast task text.

IndexedDB transactions provide correctness. BroadcastChannel only prompts other documents to refresh.

- A receiving document reloads when it sees a different install ID, a different dataset generation, or a newer global revision.
- Composer text remains untouched.
- A clean row editor reloads normally.
- A dirty row editor keeps its draft and becomes stale.
- Saving a stale revision returns `TASK CHANGED IN ANOTHER WINDOW`.
- Background updates should not open Standby or Completed sections.
- Only the document that initiated a reward shows reward, level, or rank feedback. Other documents update their HUD and lists without replaying feedback.

Handle IndexedDB lifecycle callbacks:

- On `versionchange` or the `idb` `blocking` callback, close the old connection and show a Reload requirement.
- On an upgrade `blocked` callback, show `CLOSE MECHA//TODO IN OTHER WINDOWS` with a retry action.
- On unexpected termination, attempt one clean reopen. If it fails, enter Recovery Mode.
- Never call `deleteDB()` as automatic recovery.

An older open client must not keep writing after a newer client upgrades the schema.

## 12. Validation, migration, and Recovery Mode

### 12.1 Startup sequence

```text
render static shell
open IndexedDB
run the explicit version migration
validate critical meta and every completion award
validate todos and noncritical meta
quarantine recoverable records
rebuild counters and derived statistics
load the UI projection
announce any quarantine warning
```

Display `Opening local data...` while this runs. Do not render an empty LV0 state before startup completes because that could imply data loss.

### 12.2 Schema migrations

Database version 1 creates the five stores and indexes in this plan. Future versions must use an ordered `oldVersion` switch and run inside the IndexedDB version-change transaction.

Migration rules:

- Increment the database version only for a documented schema change.
- Prefer additive changes.
- Validate every transformed record.
- Store a recovery snapshot before an incompatible transform when the existing schema has a snapshot store.
- Abort the version-change transaction on failure so the old database remains intact.
- Never catch a migration error and recreate an empty database.
- Add a Playwright fixture and migration test for every old version still supported.
- Coordinate with open clients through `versionchange` handling.

No legacy database exists in this repository, so V1 has no speculative migration from the IDEA's proposed `xpEvents` or `days` models.

### 12.3 Quarantine UX

After automatic quarantine, show a compact amber banner directly below the HUD. It remains until the user opens Settings. After that, replace it with an amber marker on Settings until the user exports or discards Quarantine.

Settings shows the count, reason codes, detected dates, Export Quarantine, and Discard Quarantine. Normal UI never renders raw quarantined task content. The raw export is a deliberate user action.

### 12.4 Recovery Mode

Recovery Mode is read-only for normal task operations. It explains the category of failure without claiming that data is gone. It offers:

- a best-effort raw export of readable stores;
- a validated backup import that replaces the broken live dataset;
- technical error details without task text in routine logs;
- the typed full-erasure action as a last resort.

If valid todos can be read safely, show them read-only. Do not calculate or display a trusted level when award integrity is unknown. Never silently skip an invalid award.

## 13. Backup and restore

### 13.1 Portable format

Use plaintext UTF-8 JSON.

```ts
type BackupV1 = {
  format: "mecha-todo-backup";
  version: 1;
  rulesVersion: 1;
  exportedAt: number;
  appVersion: string;
  data: {
    todos: Array<{
      id: string;
      text: string;
      status: TodoStatus;
      creationOrder: number;
      completionOrder: number | null;
      createdAt: number;
      updatedAt: number;
      completedAt: number | null;
    }>;
    completionAwards: CompletionAwardRecord[];
  };
  digest: `sha256:${string}`;
};
```

Do not export record revisions, derived statistics, install ID, composer draft, persistence state, install-prompt state, disclosure state, last-export time, quarantine, or recovery snapshots. V1 has no portable user setting, so the backup has no settings object.

Sort todos by creation order and awards by `dayKey`, `dailyOrdinal`, then `todoId`. Serialize a canonical object with recursively sorted object keys and no insignificant whitespace. Calculate SHA-256 over the UTF-8 canonical JSON without the `digest` field. Store a lowercase, 64-character hexadecimal digest after `sha256:`.

The digest detects accidental damage. It is not a signature and does not prove who created or edited the file.

Use this filename:

```text
mecha-todo-backup-YYYY-MM-DD.json
```

Settings must say that the file is readable plaintext and contains task text before the user exports it.

On a phone, prefer `navigator.share()` with a `File` when `navigator.canShare({ files })` returns true. Otherwise download a Blob through a temporary same-document URL. Revoke the Blob URL after use.

### 13.2 Import limits and validation

Before parsing, reject files over 32 MiB. Reject more than 100,000 live todos or 250,000 completion awards. These are safety limits, not progression limits.

Validation occurs in this order:

1. Parse the text as unknown JSON.
2. Validate the strict root shape and supported format versions with Valibot.
3. Recreate canonical JSON and verify the digest.
4. Validate every field and maximum count.
5. Validate unique todo IDs, creation orders, completion orders, award todo IDs, and day ordinals.
6. Require each day's ordinals to be contiguous from 1.
7. Recompute every award's base, LINK, COMBO, and total under its rules version. Parse day-key components and use pure Gregorian date arithmetic for yesterday so import validation does not depend on the importing device's timezone.
8. Require Completed todos to have awards. Allow Active or Standby todos to have awards because they may have been reopened.
9. Allow awards without todos because deletion retains XP.
10. Sum awards with safe-integer checks and derive progression.

Do not require `dayKey` to match `awardedAt` in the importing device's timezone. The originating timezone is intentionally not stored. Permit future-looking timestamps because device clocks can be wrong. Still require finite, nonnegative safe integers and a real Gregorian `YYYY-MM-DD` date.

Reject the whole import on any error. Existing data and the prior recovery snapshot remain unchanged.

### 13.3 Preview and confirmation

After validation, show:

- export date and app version;
- Active, Standby, and Completed todo counts;
- award count and lifetime XP;
- the resulting level and canonical rank;
- a warning that import replaces the local todo and XP dataset;
- a note that the composer draft, install state, and existing Quarantine remain local.

The user must activate `REPLACE LOCAL DATA` before the import transaction begins.

### 13.4 Backup information

Backup information lives only in Settings. Show the last successful local export time or `Never`. Do not show proactive backup reminders on the task screen.

## 14. Full local data erasure

Settings includes `ERASE ALL LOCAL DATA`.

Before enabling it:

1. Show counts for todos, awards, quarantined records, and recovery snapshots.
2. Offer Export Backup first.
3. Require the user to type the exact ASCII word `ERASE`.

On confirmation, clear every application object store in one IndexedDB transaction, recreate fresh core metadata, and then clear the composer draft and document-session marker. Regenerate the install ID and dataset generation so other open documents reload even though the state revision restarts. Return to level 0 and Cadet.

Do not delete the IndexedDB database, service worker, cached application shell, installed PWA, or the browser's persistence grant. The action cannot delete external backup files.

## 15. Client state and error handling

Solid state is a projection of IndexedDB plus transient interaction state. The repository commits every mutation immediately. There is no periodic save buffer.

Use optimistic row state only where it improves perceived response:

- A toggle marks the row immediately, then commits.
- A failure restores the previous row and focus context.
- Reward feedback waits for commit.
- Add and edit clear their drafts only after commit.
- Disable repeated action on the same pending row while allowing actions on other rows.

A transient write failure shows a persistent, specific error with Retry when safe. If reopening the database fails or state integrity becomes uncertain, enter Recovery Mode. Never display a success toast for a failed write.

## 16. Interface specification

### 16.1 Information hierarchy

The single-screen hierarchy is:

1. compact progression HUD;
2. Active Bay tasks;
3. collapsed Standby and Completed sections;
4. bottom task composer;
5. nonmodal reward and status feedback.

The progression badge is the distinctive visual element. Rows and controls stay quiet so the reward theme does not compete with the work.

There is no onboarding carousel. The first real completion teaches the loop by checking the task, showing `+10 XP`, moving the HUD to LV 001, and showing a short `LEVEL 001` status. A rank boundary may show `RANK ADVANCE · TROOPER`. These messages remain nonmodal.

### 16.2 Phone wireframe

```text
┌────────────────────────────────────┐
│ MECHA//TODO                  [SET] │
│ [BADGE] LV 014 · SERGEANT          │
│         ███████░░  12 / 27 XP     │
│ LINK READY             ACTIVE 7/10 │
├────────────────────────────────────┤
│ ○ Send invoice                     │
│ ○ Buy filters                      │
│ ○ Answer mail                      │
│                                    │
│ STANDBY 03                     ▸    │
│ COMPLETED 05                   ▸    │
│                                    │
├────────────────────────────────────┤
│ Add a task                    [Add] │
└────────────────────────────────────┘
```

Use the dynamic viewport height and safe-area insets. Keep the HUD sticky at the top and the composer sticky at the bottom. The list is the only main scrolling region. Do not let the on-screen keyboard cover the composer.

At tablet and desktop widths, center the same one-column product in a command frame with a maximum content width of 680 CSS pixels. Add gutters and breathing room, not dashboard columns. Settings is a full-screen sheet on the phone and a constrained modal on desktop.

### 16.3 Progression interaction

The compact HUD always shows:

- a 44 through 52 pixel badge;
- localized level with at least three integer digits where applicable;
- compact rank;
- current-level XP numerator, denominator, and progress bar;
- Active count and capacity;
- LINK or one-away COMBO state only when applicable.

Activating the badge or rank opens the Progression section in Settings. It shows a 96 pixel badge, canonical rank, level, lifetime XP, current-level progress, and rules version.

### 16.4 Settings contents

Settings contains these sections in this order:

1. Progression details.
2. Storage durability and a manual Protect Data retry.
3. Install status or action.
4. Update status and Reload action.
5. Backup export, last export, import, and Undo Last Restore.
6. Quarantine and Recovery information when relevant.
7. App, schema, and rules versions.
8. Erase All Local Data.

On desktop, trap focus inside the modal, close on `Escape`, and return focus to the opener. On phone, use a full-screen dialog with a visible Back action and safe-area padding.

### 16.5 Copy style

Uppercase is reserved for short system labels, the product mark, rank presentation, and status feedback. Task text, errors, explanations, empty states, confirmation text, and instructions use normal sentence case.

Use direct, stable action names. Examples:

```text
ACTIVE BAY
STANDBY
COMPLETED
LINK READY
LINK ACTIVE
UPDATE READY
ADD DIRECTIVE
REPLACE LOCAL DATA
UNDO LAST RESTORE
ERASE ALL LOCAL DATA
```

Do not use shame, failure, urgency, or clinical language. Empty Active Bay copy is `No active tasks. Add one when you are ready.`

## 17. Visual design

### 17.1 Tokens

Use the existing icon accents as the product's anchor colors and keep the rest of the palette restrained.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#09070D` | page background |
| `--color-surface` | `#15101D` | rows and HUD surface |
| `--color-surface-raised` | `#1E1629` | settings and revealed actions |
| `--color-border` | `#4A355B` | non-text structural lines |
| `--color-text` | `#F5F1F8` | primary text |
| `--color-muted` | `#B7A9C2` | secondary text |
| `--color-primary` | `#B86CFF` | structure, focus, and rank accents |
| `--color-status` | `#54FF73` | completion and healthy status |
| `--color-warning` | `#FFC857` | durability and quarantine warnings |
| `--color-danger` | `#FF6B7A` | delete and actual failures |

Primary, status, warning, danger, text, and muted colors meet WCAG AA contrast for normal text on the chosen background and surface. The border token is structural only and must not carry text or state by itself.

Do not use gradients, glass effects, soft SaaS shadows, or large rounded cards. Use one-pixel rules, square or two-pixel corners, sparse clipped corners, and a faint fixed grid only if it does not reduce text contrast. Structural marks must communicate grouping or state.

### 17.2 Typography

Bundle the Latin subset of `@fontsource-variable/jetbrains-mono`. Make no font request at runtime. Use this fallback stack:

```css
font-family: "JetBrains Mono Variable", "Cascadia Code", ui-monospace, monospace;
```

Use variable weights deliberately:

| Role | Size and line height | Weight |
|---|---|---:|
| system label | 12 / 16 px | 650 |
| task and body copy | 15 / 22 px | 450 |
| action | 14 / 20 px | 650 |
| HUD rank | 18 / 22 px | 700 |
| progression rank | 24 / 30 px | 700 |

Use tabular numerals for XP, level, and counts. Keep prose line length under 72 characters in Settings. Preserve user-entered task casing.

### 17.3 Motion

Use motion only for a state change:

- 600 ms checked-row hold;
- a short XP-bar interpolation after a committed award;
- one HUD pulse for a level or rank change;
- one count pulse for a changed collapsed section;
- direct swipe tracking under the pointer.

Do not animate screen entry, every row, hover states, or decorative background elements. No interaction may wait for animation completion.

## 18. Accessibility

Meet WCAG 2.2 AA for the supported Chrome targets.

- All actions work with keyboard and pointer without swipe.
- Interactive targets are at least 44 by 44 CSS pixels.
- Focus indicators use a two-pixel high-contrast outline and are never removed.
- The leading control has an accessible name such as `Mark Send invoice complete` or `Reopen Send invoice`.
- Delete includes the task name in its accessible name.
- The progress element exposes current value, minimum, maximum, level, and canonical rank.
- The compact rank's accessible name contains the full canonical title.
- One `aria-live="polite"` region announces aggregated rewards and save errors.
- Color never carries status alone. Pair it with text, shape, or an icon.
- Strike-through completed text retains readable contrast.
- Settings dialogs manage focus and return it to their opener.
- Invalid fields connect errors through `aria-describedby` and set `aria-invalid`.
- `prefers-reduced-motion: reduce` removes nonessential animation.
- Forced-colors mode preserves borders, focus, controls, and state labels.
- Touch gestures do not block vertical scrolling or browser navigation.

Use semantic roles and accessible names as the primary Playwright locators. Add test IDs only where no stable semantic locator exists.

## 19. Storage durability and PWA behavior

### 19.1 Normal web contract

All task, progression, backup, recovery, and Settings features work in normal Chrome over HTTPS. Installation is optional. The app works offline only after one successful online load has cached the application shell. A first-ever offline visit is unsupported.

The normal tab and installed PWA use the same origin database when launched from the same Chrome profile. A different origin, including a Vercel preview URL, is a different installation.

### 19.2 Persistent storage

After the first valid todo commits, call `navigator.storage.persist()` once without interrupting the task flow. Record that the automatic attempt occurred.

- If granted, Settings shows `PERSISTENCE · PROTECTED`.
- If supported but denied, Settings shows `PERSISTENCE · BEST EFFORT` and offers `PROTECT DATA` for a manual retry.
- If unsupported, Settings shows `PERSISTENCE · UNAVAILABLE`.
- An API exception shows an amber explanation. It does not imply that the todo save failed.

Never repeatedly prompt on launch. Browser data can still be removed by the user, device loss, browser bugs, or site-data clearing. Settings explains this next to backup controls.

### 19.3 Install suggestion

Capture the Chrome `beforeinstallprompt` event without displaying it immediately. A mobile-only suggestion becomes eligible when either condition is true:

```text
at least 2 document sessions and at least 1 completion award
or
at least 5 completion awards
```

Count one document session with a session-storage marker so refreshes in the same tab do not inflate the launch count. If the browser provides no install event, show no proactive prompt.

Dismissal permanently suppresses proactive prompts for that installation. Settings keeps an Install action when the browser permits it. Desktop relies on browser UI and Settings. Do not proactively interrupt desktop use.

Install copy promises faster launch and offline shell access. It must not promise that local data can never be lost.

### 19.4 Manifest and offline shell

The manifest uses the configured product name, neutral start path, `display: "standalone"`, dark theme and background colors, and the existing 192 and 512 pixel regular and maskable icons.

Use `vite-plugin-pwa` to precache versioned same-origin HTML, JavaScript, CSS, the bundled font, and icons. Cache no task data and make no runtime third-party request. Export and import continue to work offline.

### 19.5 Updates

Download a new service worker in the background. When it is ready, show `UPDATE READY` with a Reload action. Never force a reload.

Define unsaved UI state as either:

- a nonempty composer draft that has not become a todo; or
- a row editor whose draft differs from the stored record.

If either exists, Reload does not activate the waiting service worker. Show `Save or cancel your edit before reloading.` After the UI is clean, the user must activate Reload again. IndexedDB `versionchange` handling still closes incompatible old connections.

### 19.6 Deployment

Deploy the production build as static assets on Vercel. Do not add Functions, API routes, environment secrets, or a server database.

Use one stable HTTPS production origin for the real list. Vercel preview URLs and a future custom domain have separate origin storage. State this in deployment documentation before changing the production hostname.

Serve hashed build assets with long-lived immutable caching. Serve the HTML entry point, web manifest, and service-worker entry with revalidation so updates can be discovered. Register the service worker from the application module rather than an inline script so the Content Security Policy can remain strict.

## 20. Privacy and security

The application makes no runtime request except same-origin application assets and update checks. It has no analytics, telemetry, crash reporter, remote font, ad code, API client, or third-party SDK.

Do not put task text in URLs, document titles, BroadcastChannel messages, routine console logs, analytics-shaped events, or error reports. Hosting providers may retain ordinary HTTP request logs, but the application sends no task content to the host.

Backup export and user-initiated system sharing are the only paths that intentionally move task text outside IndexedDB. The backup warning must state this.

Configure static-host security headers where Vercel permits them:

```text
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self'; img-src 'self' data:; font-src 'self'; worker-src 'self' blob:
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

If the chosen Solid or Vite output needs an additional CSP directive, document the smallest required exception. Do not add a broad third-party source.

## 21. Technical stack

Use one verified, exact dependency set and commit `package-lock.json`. The baseline below was registry-checked on 2026-09-11.

| Package | Baseline |
|---|---:|
| Node.js | `24.15.0` |
| npm | `11.12.1` |
| `solid-js` | `2.0.0-rc.8` |
| `@solidjs/web` | `2.0.0-rc.8` |
| `@solidjs/vite-plugin` | `3.0.0-next.42` |
| `vite` | `8.3.0` |
| `typescript` | `7.0.2` |
| `tailwindcss` | `4.3.3` |
| `@tailwindcss/vite` | `4.3.3` |
| `idb` | `8.0.3` |
| `valibot` | `1.5.0` |
| `vite-plugin-pwa` | `1.3.0` |
| `@fontsource-variable/jetbrains-mono` | `5.3.0` |
| `@playwright/test` | `1.63.0` |
| `@axe-core/playwright` | `4.13.0` |

The selected Solid Vite plugin requires Vite 8 or 9, Solid and `@solidjs/web` at least RC 7, and Node `20.19` or later or `22.12` or later. The baseline satisfies those constraints.

Solid 2 is still a prerelease line at the time of this plan. Do not silently substitute Solid 1 or a different Vite plugin. Before scaffolding, run an empty production build and one Playwright smoke test with the exact set. If it fails, update the Solid compiler, runtime, web renderer, and Vite plugin as one compatible group and record the deviation in this file before application work begins.

Do not add a component kit, router, state library, date library, gesture library, icon pack, animation library, ORM, server framework, or second test framework for V1.

## 22. Proposed source layout

```text
public/
  icons/
src/
  app/
    App.tsx
    app-store.ts
  components/
    AddTodo.tsx
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
    backup.ts
    db.ts
    migrations.ts
    models.ts
    repository.ts
    schemas.ts
    startup-validation.ts
  pwa/
    install.ts
    storage-durability.ts
    updates.ts
  styles/
    app.css
  testing/
    install-test-bridge.ts
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
    backup-recovery.spec.ts
    concurrency.spec.ts
    corruption.spec.ts
    migration.spec.ts
    pwa.spec.ts
    responsive-interaction.spec.ts
    todo-flow.spec.ts
  fixtures/
playwright.config.ts
vite.config.ts
```

Keep domain files free of Solid, DOM, IndexedDB, and current-time dependencies. Inject a clock and repository dependencies where behavior needs them.

The Playwright runner may import pure domain modules directly. This is still one test framework. `@axe-core/playwright` is an accessibility assertion helper, not another runner.

## 23. Test-only high-level seam

Do not manufacture tens of millions of fake awards or weaken production import validation to render level 1,000,000.

Build `src/testing/install-test-bridge.ts` only when `import.meta.env.MODE === "test"`. It may override the in-memory progression projection and clock for UI tests. It must not write impossible records to IndexedDB or participate in backup import.

Production requirements:

- `window.__MECHA_TEST__` is absent;
- the test module is absent from the production bundle after tree shaking;
- a production-build test verifies both facts.

Domain tests call progression and rank functions directly at exact high-level XP thresholds. UI tests use the test-only projection to inspect long rank and badge layout.

## 24. Automated testing

### 24.1 Playwright projects

Use these projects:

| Project | Purpose | Release gate |
|---|---|---|
| `desktop-chrome` with `channel: "chrome"` | Full behavior, persistence, recovery, PWA, and accessibility suite | Required |
| `mobile-chrome` with Chromium mobile emulation | 360 and 430 pixel layouts, touch, swipe, keyboard, responsive states | Required |
| `desktop-firefox-smoke` | Add, edit, complete, reload, export smoke path | Informational |

Run service-worker tests against a production build and HTTPS-capable test host or a browser-trusted localhost context. Do not infer installed-PWA durability from emulation.

### 24.2 Domain cases

Test at least:

- whitespace normalization, code-point length 1 and 280, rejection at 0 and 281, multiline paste, and duplicate text;
- every capacity boundary from levels 0 through 45;
- new-todo placement, over-capacity reopen, no demotion, and multi-slot rank promotion;
- reward ordinals 1, 5, 6, 10, 11, 15, 16, 20, and 21;
- LINK with and without yesterday, including month, year, leap-day, and daylight-saving boundaries;
- proof that LINK and COMBO cannot coexist under rules V1;
- one award per todo and permanent awards after delete;
- thresholds at levels 0, 1, 2, 3, 4, 5, 10, 20, 50, 100, 1,000, 10,000, and 1,000,000;
- exact-threshold level lookup, one XP below, finite progress, monotonic thresholds, and maximum-safe XP;
- pacing configurations 250, 500, and 1,000 through a pure parameterized curve function while production stays fixed at 500;
- every base rank, prestige indices 1, 8, and 9, long prestige, and deterministic badges.

### 24.3 Browser behavior

Test at least:

- fresh start at LV 000 Cadet and first completion at LV 001;
- composer draft restoration and successful clearing;
- Active and Standby placement, session-only disclosures, and 20-record paging;
- inline editing of every status, blur save, Enter save, Escape cancel, and validation errors;
- immediate checked state, 600 ms hold, promotion timing, and reopen during hold;
- rapid reward aggregation and polite live-region output;
- completion, reopen, already-credited completion, delete, five-second Undo, and expired Undo;
- deletion with and without an award, with no XP change in either case;
- recovery-snapshot invalidation after every task mutation;
- two pages completing or editing the same todo, stale draft preservation, and BroadcastChannel refresh;
- reload and new browser context persistence and isolation;
- local midnight and browser timezone changes with immutable historical day keys;
- valid export and import, digest damage, unknown version, duplicate award, invalid ordinal, impossible bonus, oversized input, and rollback;
- malformed todo quarantine, malformed setting quarantine, malformed award Recovery Mode, and database-open failure presentation;
- typed data erasure and proof that the application shell remains installed/cached;
- persistent-storage granted, denied, unavailable, and manual-retry UI through API stubs;
- install eligibility, dismissal, Settings access, and no desktop proactive prompt;
- update-ready handling with clean state, composer draft, and dirty row edit;
- offline reload after one online visit and a clear failure for an uncached first visit;
- manifest fields, icons, font locality, and absence of runtime third-party requests;
- normal 360 and 430 pixel phone widths, desktop width, on-screen keyboard viewport behavior, and no horizontal overflow;
- swipe thresholds, vertical-scroll preservation, no full-swipe delete, and keyboard alternatives;
- reduced motion, forced colors, visible focus, dialog focus, accessible names, live regions, and automated axe checks;
- level 10,000 and level 1,000,000 presentation through the test-only seam;
- absence of the test bridge in the production build.

Use deterministic clocks and timezones. Do not wait for real midnight. Tests may inject the domain clock or use Playwright's clock support.

### 24.4 Visual and performance checks

Keep reviewed screenshots for the 360 pixel phone, 430 pixel phone, and desktop command frame. Include empty, ordinary list, Standby expanded, reward milestone, long rank, Settings, quarantine, and Recovery Mode states.

Budgets:

- initial application JavaScript at or below 100 KiB Brotli, excluding the font;
- initial CSS at or below 25 KiB Brotli;
- total precached shell at or below 500 KiB Brotli;
- no full completion-history render on startup;
- no level-by-level lookup;
- no full award scan on each completion;
- optimistic task-state paint in the next animation frame;
- repository mutation target below 100 ms at the 95th percentile on the Pixel acceptance dataset.

Use indexes and the rebuildable stats cache for daily and XP operations. Measure timing on the real Pixel with at least 5,000 todos and 10,000 awards. Treat the timing target as a release investigation threshold rather than a flaky CI assertion.

## 25. Manual device acceptance

Before V1 release, test on the actual devices in scope.

### Pixel 10 Pro with Chrome

- normal web add, edit, complete, reopen, delete, and reload;
- installed PWA launch and the same dataset as the normal Chrome profile;
- offline launch after caching;
- swipe behavior alongside vertical scroll and Android navigation gestures;
- on-screen keyboard and bottom composer;
- persistent-storage status;
- file export through share or download and file import;
- update-ready flow;
- 5,000-todo and 10,000-award interaction timing.

### Two Windows 11 desktops

- run the supported flow in Chrome on both machines;
- confirm each desktop and the phone begin as independent lists;
- transfer a backup from one installation to another, confirm exact replacement, then confirm later edits do not sync;
- run a best-effort Firefox smoke check on each desktop;
- on the development desktop, run the full Playwright Chrome suite.

Record browser versions and pass or fail results in the release checklist. Do not claim mobile acceptance based only on Playwright emulation.

## 26. Implementation sequence

Each phase ends with its tests passing. Do not postpone all testing until the end.

### Phase 1. Scaffold and compatibility proof

- Create Vite, Solid 2, TypeScript, Tailwind, and Playwright configuration.
- Pin the verified dependency set and commit the lockfile.
- Add the product config and bundled JetBrains Mono.
- Produce one accessible empty shell.
- Prove development build, production build, typecheck, and one Chrome smoke test.

Gate: no dependency compatibility warning, no remote request, and no test framework other than Playwright.

### Phase 2. Pure domain rules

- Implement text normalization, day keys, rewards, progression, capacity, ranks, and badge descriptors.
- Add direct Playwright-runner tests for all boundary tables.
- Freeze rules V1 in one config module.

Gate: the exact reward, threshold, rank, and capacity reference cases pass.

### Phase 3. IndexedDB and repository

- Create schema V1, Valibot schemas, indexes, migrations, and lifecycle handlers.
- Implement startup validation, Quarantine, Recovery Mode results, counters, derived stats, and repository commands.
- Implement sequence ordering and optimistic-concurrency revisions.
- Add persistence, corruption, and two-page tests.

Gate: no component accesses IndexedDB directly; atomicity and one-award constraints hold during racing pages.

### Phase 4. Core todo interface

- Build the HUD shell, composer, Active list, Standby and Completed disclosures, inline editing, delete, and Undo.
- Implement 20-record incremental section queries.
- Add optimistic visual state and failure rollback.

Gate: the whole task lifecycle works with keyboard and pointer before swipe or decorative badge work.

### Phase 5. Rewards and progression integration

- Connect completion transactions to reward feedback, XP progress, rank, LINK, COMBO, capacity changes, and promotion.
- Implement the 600 ms row hold and 400 ms aggregation window.
- Add the test-only high-level display seam.

Gate: every reward table case, reopen case, deletion case, and rapid-completion case passes through the rendered app.

### Phase 6. Durability, backup, and recovery

- Add persistence request and status.
- Implement canonical backup, mobile export, strict preview/import, recovery snapshot, and Undo Last Restore.
- Add Quarantine management, Recovery Mode UI, and typed full erasure.

Gate: an invalid import cannot modify live data, a valid import reproduces progression exactly, and no automatic error path deletes the database.

### Phase 7. Responsive interaction and visual system

- Apply final tokens, typography, command-frame layout, focus styles, and copy.
- Add Pointer Event swipes and all fallback actions.
- Complete mobile Settings, desktop modal behavior, reduced motion, and forced-colors handling.
- Run screenshot critique at each required viewport and remove decorative elements that do not communicate state.

Gate: 360 pixel width has no horizontal overflow, all targets meet 44 pixels, and axe plus keyboard tests pass.

### Phase 8. Procedural badges

- Define every base silhouette and prestige modifier.
- Render deterministic crisp SVG from the tested descriptor.
- Integrate compact and Settings sizes.

Gate: all base ranks, repeated prestige atoms, long prestige titles, and deterministic snapshots pass.

### Phase 9. PWA and updates

- Configure manifest, local icons, app-shell caching, install suggestion, and update-ready flow.
- Add offline and production-build service-worker tests.
- Confirm no task data enters caches.

Gate: normal web remains fully functional, cached offline launch works, and unsaved edits block reload.

### Phase 10. Release pass

- Run required Playwright projects.
- Run bundle and network audits.
- Complete the Pixel and two-desktop checklist.
- Deploy to one stable production origin.
- Verify backup export before using the production origin as the real list.

Gate: every V1 acceptance criterion below is checked with an automated test or a recorded manual result.

## 27. V1 acceptance criteria

### Task behavior

- [ ] A fresh installation shows LV 000 Cadet and an empty Active Bay.
- [ ] A valid todo saves in one action and survives reload.
- [ ] Text normalization and the 280-code-point limit match section 5.1.
- [ ] Active, Standby, and Completed sorting remains stable across clock changes and reloads.
- [ ] Capacity affects new placement but never blocks reopen.
- [ ] Opening capacity promotes the oldest Standby todos.
- [ ] Editing any status has no XP or ordering side effect.
- [ ] Completion and swipe behavior have keyboard and visible-button alternatives.
- [ ] Delete is immediate, has a five-second volatile Undo, and removes app-managed task text.

### Rewards and progression

- [ ] The first completion creates exactly one immutable award.
- [ ] Reopen and re-complete create zero additional XP.
- [ ] Deletion never changes lifetime XP.
- [ ] LINK and milestone-only COMBO match the exact tables.
- [ ] Deleted awards continue to count for ordinals, LINK, and progression.
- [ ] Level thresholds and procedural ranks match the reference cases.
- [ ] Current-level XP appears in the HUD; lifetime XP appears in Settings.
- [ ] High-level lookup is logarithmic and safe through the documented range.
- [ ] Every rank produces a deterministic badge and accessible canonical title.

### Persistence and recovery

- [ ] IndexedDB is authoritative and no service-worker cache contains task data.
- [ ] Todos, awards, ordering, and XP survive browser and PWA restarts.
- [ ] Same-profile windows converge without duplicate awards.
- [ ] Malformed noncritical records enter Quarantine.
- [ ] Award, rule, migration, and database integrity failures enter Recovery Mode.
- [ ] No automatic path calls `deleteDB()` or starts over silently.
- [ ] Backup export is plaintext, canonical, digested, and portable.
- [ ] Import rejects semantic impossibilities before writing and replaces data atomically after confirmation.
- [ ] Undo Last Restore works until the next task mutation.
- [ ] Typed full erasure returns to LV 000 without uninstalling the application shell.

### Web and PWA

- [ ] Core behavior works in normal supported Chrome without installation.
- [ ] Offline launch works after one successful cached visit.
- [ ] Persistence is requested once after the first saved todo and remains retryable in Settings.
- [ ] Mobile install suggestion timing and dismissal match section 19.3.
- [ ] Updates wait for explicit Reload and never discard an unsaved composer or edit draft.
- [ ] Each origin and browser profile remains an independent list unless a backup replaces it.

### Interface and accessibility

- [ ] The task list remains the dominant visual content at 360 through 430 CSS pixels.
- [ ] Desktop stays a centered one-column command surface no wider than 680 pixels.
- [ ] Standby and Completed start collapsed on a fresh launch and never auto-open.
- [ ] Reward feedback aggregates rapid actions and never blocks the next task.
- [ ] Settings is full-screen on phone and a focus-managed modal on desktop.
- [ ] WCAG 2.2 AA, reduced motion, forced colors, keyboard behavior, and 44 pixel targets pass.
- [ ] English copy uses no shame, clinical claims, or remote content.

### Privacy and release

- [ ] Production makes no third-party runtime request and sends no task content off device.
- [ ] The bundled font, manifest, icons, and service worker work from the production origin.
- [ ] The production bundle contains no test bridge.
- [ ] Required Playwright Chrome projects pass.
- [ ] The actual Pixel 10 Pro and both Windows 11 desktops pass the recorded device checklist.

## 28. Explicit corrections to the IDEA document

These changes are intentional and must not be "fixed" back to V4 behavior:

| IDEA statement or ambiguity | V1 resolution |
|---|---|
| Display name `TASK//MARCH` | Working display name is `MECHA//TODO` |
| Deleting a rewarded todo revokes XP | Deletion keeps its anonymous immutable award and XP |
| Soft deletion retains todo text | Delete removes the todo record and app-managed snapshots |
| Positive and revocation events share a unique todo index | `completionAwards` has one row keyed by todo ID and no revocation rows |
| `by-awarded-at` indexes a nonexistent field | Award records contain `awardedAt` |
| Tier COMBO rewards every task after a boundary | COMBO rewards only exact ordinals 5, 10, 15, and 20 |
| Example shows LINK and COMBO together | Rules V1 makes that combination impossible |
| Visible LINK chain length | No chain length or streak is shown or stored as a product statistic |
| `days` can become a second source of truth | Remove the store and derive day state from award indexes |
| Reopening under a full Active Bay is undefined | Reopen always enters Active and may exceed capacity |
| Completed history render size is undefined | Load 20 at a time, newest first |
| Standby render size is undefined | Load 20 at a time, oldest first |
| Custom font is optional | Bundle JetBrains Mono Variable with no remote request |
| All modern browsers are implied support targets | Chrome is supported; Firefox and WebKit are best effort |
| PWA installation is tied to Safari durability | Chrome PWA adds install and offline ergonomics; core web behavior remains complete |
| Recovery snapshots rotate indefinitely | Keep only one pre-import snapshot and invalidate it on task mutation |
| Backups include derived day and settings state | Export only portable todos and immutable awards |
| A valid high-level production backup seeds stress tests | Use a production-excluded test projection for impossible high levels |
| Level 20 and 50 estimates were approximate and low | Exact rounded thresholds are 546 and 1,938 XP |
| Playwright means browser E2E only | One Playwright runner covers direct pure-module tests and browser E2E |
| Cross-window writes are unspecified | Use record revisions, atomic constraints, and BroadcastChannel refresh |
| Install and update timing are unspecified | Use the explicit eligibility and unsaved-state rules in section 19 |

## 29. Future changes

Cloud sync, recurring work, reminders, native packaging, portable user preferences, or a new reward version each need a new specification. Do not infer them from extension points in the repository.

If sync is added later, keep IndexedDB as the immediate local source and design conflict resolution above the repository boundary. Do not reuse V1's BroadcastChannel protocol as a network sync protocol.

If reward tuning changes, preserve V1 awards exactly. Define how new daily ordinals interact across rule versions before shipping a second version.

If the display name changes, update the product config and visible assets. Do not rename the database or backup format merely for branding.
