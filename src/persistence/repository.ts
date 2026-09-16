import type { IDBPDatabase, IDBPTransaction } from "idb";
import { DATABASE_NAME } from "../config/product";
import { activeCapacity } from "../domain/capacity";
import {
  localCalendarDate,
  previousDayKey,
  toDayKey,
  type LocalCalendarDate,
} from "../domain/day-key";
import { progressionForTotalXp, type Progression } from "../domain/progression";
import { rankForLevel } from "../domain/ranks";
import { calculateCompletionAward } from "../domain/rewards";
import { createTodoId, normalizeTodoText, type InvalidTodoText } from "../domain/todo-text";
import { clearComposerDraft } from "./composer-draft";
import { deleteAppDatabase, openVersionedDatabase } from "./db";
import type { MechaTodoDatabase } from "./db-schema";
import type {
  CompletionAwardRecord,
  TodoRecord,
  TodoStatus,
} from "./models";
import { eraseDatabaseContents } from "./startup";
import {
  hasExpectedDatabaseStructure,
  prepareDatabaseForStartup,
} from "./validation";

export const TODO_PAGE_SIZE = 20;
export const LIST_CHANGED_MESSAGE = "List changed in another tab. Reload to continue.";

export type TodoPageCursor = Readonly<{
  order: number;
  id: string;
}>;

export type TodoPage = Readonly<{
  items: TodoRecord[];
  hasMore: boolean;
  nextCursor: TodoPageCursor | null;
}>;

export type ProjectionQuery = Readonly<{
  standbyAfter?: TodoPageCursor;
  completedBefore?: TodoPageCursor;
}>;

export type RewardHudState = Readonly<{
  link: "ready" | "active" | null;
  combo: Readonly<{ current: 4 | 9 | 14 | 19; target: 5 | 10 | 15 | 20 }> | null;
}>;

export type AppProjection = Readonly<{
  activeTodos: TodoRecord[];
  standbyTodos: TodoPage;
  completedTodos: TodoPage;
  standbyCount: number;
  completedCount: number;
  lifetimeXp: number;
  progression: Progression;
  rank: string;
  activeCapacity: number;
  rewardHud: RewardHudState;
}>;

export type StartupResult =
  | Readonly<{ ok: true; projection: AppProjection }>
  | Readonly<{
      ok: false;
      category: "blocked";
      message: string;
      retryable: boolean;
    }>
  | Readonly<{
      ok: false;
      category: "local-data";
      technicalCategory: LocalDataTechnicalCategory;
      message: "Local data could not be opened.";
      retryable: true;
    }>;

export type LocalDataTechnicalCategory =
  | "migration-failed"
  | "open-failed"
  | "invalid-database-schema"
  | "invalid-todo"
  | "invalid-award"
  | "invalid-meta"
  | "unsupported-rules"
  | "unsafe-xp"
  | "unsafe-counter"
  | "inconsistent-records"
  | "metadata-rebuild-failed"
  | "projection-failed"
  | "erase-transaction-failed"
  | "delete-blocked"
  | "delete-failed"
  | "recreate-failed";

export type EraseConfirmation = Readonly<{ confirmed: boolean }>;

export type EraseLocalDataResult =
  | Readonly<{ ok: true; projection: AppProjection }>
  | Readonly<{ ok: false; category: "cancelled" }>
  | Readonly<{
      ok: false;
      category: "local-data";
      technicalCategory: LocalDataTechnicalCategory;
      message: "Local data could not be opened.";
    }>;

export type MutationSuccess = Readonly<{
  ok: true;
  todo: TodoRecord;
  projection: AppProjection;
}>;

type ValidationFailure = Readonly<{
  ok: false;
  category: "validation";
  validation: InvalidTodoText;
}>;

type ChangedInAnotherTabFailure = Readonly<{
  ok: false;
  category: "changed-in-another-tab";
  message: typeof LIST_CHANGED_MESSAGE;
}>;

type WriteFailure = Readonly<{
  ok: false;
  category: "write-failed";
  message: "Task could not be saved. Retry.";
}>;

export type MutationResult =
  | MutationSuccess
  | ValidationFailure
  | ChangedInAnotherTabFailure
  | WriteFailure;

export type CompletionMutationSuccess = Readonly<{
  ok: true;
  action: "completed" | "reopened";
  changed: boolean;
  todo: TodoRecord;
  award: CompletionAwardRecord | null;
  xpGained: number;
  alreadyCredited: boolean;
  promotedTodoIds: string[];
  projection: AppProjection;
}>;

export type CompletionMutationResult =
  | CompletionMutationSuccess
  | ChangedInAnotherTabFailure
  | WriteFailure;

export type DeleteMutationSuccess = Readonly<{
  ok: true;
  deletedTodo: TodoRecord;
  retainedAward: boolean;
  promotedTodoIds: string[];
  projection: AppProjection;
}>;

export type DeleteMutationResult =
  | DeleteMutationSuccess
  | ChangedInAnotherTabFailure
  | WriteFailure;

export interface AppRepository {
  initialize(options?: Readonly<{ summaryOnly?: boolean }>): Promise<StartupResult>;
  getProjection(query?: ProjectionQuery): Promise<AppProjection>;
  getSummaryProjection(): Promise<AppProjection>;
  getTodoPage(status: "standby" | "completed", cursor?: TodoPageCursor): Promise<TodoPage>;
  addTodo(text: string): Promise<MutationResult>;
  editTodo(id: string, text: string): Promise<MutationResult>;
  setTodoCompleted(id: string, completed: boolean): Promise<CompletionMutationResult>;
  deleteTodo(id: string): Promise<DeleteMutationResult>;
  restoreDeletedTodo(snapshot: TodoRecord): Promise<MutationResult>;
  eraseLocalData(confirmation: EraseConfirmation): Promise<EraseLocalDataResult>;
  close(): void;
}

type RepositoryOptions = Readonly<{
  databaseName?: string;
  clock?: () => number;
  calendarClock?: () => number;
  idFactory?: () => string;
  calendar?: (timestamp: number) => LocalCalendarDate;
  clearDraft?: () => void;
}>;

type CommittedCompletionMutation = Omit<CompletionMutationSuccess, "projection">;

type ProjectionTransaction = IDBPTransaction<
  MechaTodoDatabase,
  ("todos" | "completionAwards" | "meta")[],
  "readonly"
>;

type MutationTransaction = IDBPTransaction<
  MechaTodoDatabase,
  ("todos" | "completionAwards" | "meta")[],
  "readwrite"
>;

export class IndexedDbAppRepository implements AppRepository {
  readonly #databaseName: string;
  readonly #clock: () => number;
  readonly #calendarClock: () => number;
  readonly #idFactory: () => string;
  readonly #calendar: (timestamp: number) => LocalCalendarDate;
  readonly #clearDraft: () => void;
  #database: IDBPDatabase<MechaTodoDatabase> | null = null;

  constructor({
    databaseName = DATABASE_NAME,
    clock = Date.now,
    calendarClock = Date.now,
    idFactory = createTodoId,
    calendar = (timestamp) => localCalendarDate(new Date(timestamp)),
    clearDraft = clearComposerDraft,
  }: RepositoryOptions = {}) {
    this.#databaseName = databaseName;
    this.#clock = clock;
    this.#calendarClock = calendarClock;
    this.#idFactory = idFactory;
    this.#calendar = calendar;
    this.#clearDraft = clearDraft;
  }

  async initialize(
    { summaryOnly = false }: Readonly<{ summaryOnly?: boolean }> = {},
  ): Promise<StartupResult> {
    if (this.#database) {
      try {
        return {
          ok: true,
          projection: summaryOnly
            ? await this.getSummaryProjection()
            : await this.getProjection(),
        };
      } catch {
        this.close();
        return localDataProblem("projection-failed");
      }
    }

    const opened = await openVersionedDatabase({
      name: this.#databaseName,
      createdAt: this.#clock(),
    });
    if (!opened.ok) {
      if (opened.category === "blocked") {
        return {
          ok: false,
          category: "blocked",
          message: opened.message,
          retryable: opened.retryable,
        };
      }
      return localDataProblem(opened.category);
    }

    const preparation = await prepareDatabaseForStartup(opened.database);
    if (!preparation.ok) {
      opened.database.close();
      return localDataProblem(preparation.category);
    }

    this.#database = opened.database;
    try {
      return {
        ok: true,
        projection: summaryOnly
          ? await this.getSummaryProjection()
          : await this.getProjection(),
      };
    } catch {
      this.close();
      return localDataProblem("projection-failed");
    }
  }

  async getSummaryProjection(): Promise<AppProjection> {
    const database = this.#requireDatabase();
    const transaction = database.transaction(
      ["todos", "completionAwards", "meta"],
      "readonly",
    );
    const todoIndex = transaction.objectStore("todos").index("by-status-creation-order");
    const activeTodosPromise = todoIndex.getAll(statusRange("active"));
    const standbyCountPromise = todoIndex.count(statusRange("standby"));
    const completedCountPromise = todoIndex.count(statusRange("completed"));
    const statsPromise = transaction.objectStore("meta").get("derived-stats");
    const rewardHudPromise = readRewardHudState(
      transaction,
      this.#calendar(this.#calendarClock()),
    );
    const [activeTodos, standbyCount, completedCount, stats, rewardHud] = await Promise.all([
      activeTodosPromise,
      standbyCountPromise,
      completedCountPromise,
      statsPromise,
      rewardHudPromise,
    ]);
    await transaction.done;

    if (!stats || stats.key !== "derived-stats") {
      throw new Error(LIST_CHANGED_MESSAGE);
    }

    const progression = progressionForTotalXp(stats.lifetimeXp);

    return Object.freeze({
      activeTodos,
      standbyTodos: emptyTodoPage(),
      completedTodos: emptyTodoPage(),
      standbyCount,
      completedCount,
      lifetimeXp: stats.lifetimeXp,
      progression,
      rank: rankForLevel(progression.level),
      activeCapacity: activeCapacity(progression.level),
      rewardHud,
    });
  }

  async getProjection(query: ProjectionQuery = {}): Promise<AppProjection> {
    const database = this.#requireDatabase();
    const transaction = database.transaction(
      ["todos", "completionAwards", "meta"],
      "readonly",
    );
    const todoIndex = transaction.objectStore("todos").index("by-status-creation-order");
    const activeTodosPromise = todoIndex.getAll(statusRange("active"));
    const standbyTodosPromise = readStandbyPage(transaction, query.standbyAfter);
    const completedTodosPromise = readCompletedPage(transaction, query.completedBefore);
    const standbyCountPromise = todoIndex.count(statusRange("standby"));
    const completedCountPromise = todoIndex.count(statusRange("completed"));
    const statsPromise = transaction.objectStore("meta").get("derived-stats");
    const rewardHudPromise = readRewardHudState(
      transaction,
      this.#calendar(this.#calendarClock()),
    );
    const [
      activeTodos,
      standbyTodos,
      completedTodos,
      standbyCount,
      completedCount,
      stats,
      rewardHud,
    ] = await Promise.all([
      activeTodosPromise,
      standbyTodosPromise,
      completedTodosPromise,
      standbyCountPromise,
      completedCountPromise,
      statsPromise,
      rewardHudPromise,
    ]);
    await transaction.done;

    if (!stats || stats.key !== "derived-stats") {
      throw new Error(LIST_CHANGED_MESSAGE);
    }

    const progression = progressionForTotalXp(stats.lifetimeXp);

    return Object.freeze({
      activeTodos,
      standbyTodos,
      completedTodos,
      standbyCount,
      completedCount,
      lifetimeXp: stats.lifetimeXp,
      progression,
      rank: rankForLevel(progression.level),
      activeCapacity: activeCapacity(progression.level),
      rewardHud,
    });
  }

  async getTodoPage(
    status: "standby" | "completed",
    cursor?: TodoPageCursor,
  ): Promise<TodoPage> {
    const transaction = this.#requireDatabase().transaction(
      ["todos", "completionAwards", "meta"],
      "readonly",
    );
    const page =
      status === "standby"
        ? await readStandbyPage(transaction, cursor)
        : await readCompletedPage(transaction, cursor);
    await transaction.done;
    return page;
  }

  async addTodo(text: string): Promise<MutationResult> {
    const validation = normalizeTodoText(text);
    if (!validation.ok) {
      return { ok: false, category: "validation", validation };
    }

    const database = this.#requireDatabase();

    try {
      const transaction = database.transaction(["todos", "meta"], "readwrite");
      const todos = transaction.objectStore("todos");
      const meta = transaction.objectStore("meta");
      const [core, stats, activeCount] = await Promise.all([
        meta.get("core"),
        meta.get("derived-stats"),
        todos.index("by-status-creation-order").count(statusRange("active")),
      ]);

      if (!core || core.key !== "core" || !stats || stats.key !== "derived-stats") {
        transaction.abort();
        await transaction.done.catch(() => undefined);
        return changedInAnotherTab();
      }

      const level = progressionForTotalXp(stats.lifetimeXp).level;
      const status: TodoStatus = activeCount < activeCapacity(level) ? "active" : "standby";
      const timestamp = this.#clock();
      const todo: TodoRecord = {
        id: this.#idFactory(),
        text: validation.value,
        status,
        creationOrder: core.nextCreationOrder,
        completionOrder: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
      };

      await Promise.all([
        todos.add(todo),
        meta.put({ ...core, nextCreationOrder: core.nextCreationOrder + 1 }),
      ]);
      await transaction.done;

      this.#clearDraft();

      return { ok: true, todo, projection: await this.getProjection() };
    } catch {
      return writeFailed();
    }
  }

  async editTodo(id: string, text: string): Promise<MutationResult> {
    const validation = normalizeTodoText(text);
    if (!validation.ok) {
      return { ok: false, category: "validation", validation };
    }

    const database = this.#requireDatabase();

    try {
      const transaction = database.transaction("todos", "readwrite");
      const todos = transaction.objectStore("todos");
      const current = await todos.get(id);

      if (!current) {
        await transaction.done;
        return changedInAnotherTab();
      }

      const todo: TodoRecord = {
        ...current,
        text: validation.value,
        updatedAt: this.#clock(),
      };
      await todos.put(todo);
      await transaction.done;

      return { ok: true, todo, projection: await this.getProjection() };
    } catch {
      return writeFailed();
    }
  }

  async setTodoCompleted(id: string, completed: boolean): Promise<CompletionMutationResult> {
    const maximumAttempts = 3;

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        const committed = await this.#commitCompletionMutation(id, completed);
        if (!committed.ok) {
          return committed;
        }

        return { ...committed, projection: await this.getProjection() };
      } catch (error) {
        if (isConstraintError(error) && attempt < maximumAttempts) {
          continue;
        }
        return writeFailed();
      }
    }

    return writeFailed();
  }

  async deleteTodo(id: string): Promise<DeleteMutationResult> {
    const database = this.#requireDatabase();

    try {
      const transaction = database.transaction(
        ["todos", "completionAwards", "meta"],
        "readwrite",
      );
      const todos = transaction.objectStore("todos");
      const awards = transaction.objectStore("completionAwards");
      const meta = transaction.objectStore("meta");
      const [current, retainedAward, stats] = await Promise.all([
        todos.get(id),
        awards.get(id),
        meta.get("derived-stats"),
      ]);

      if (!current || !stats || stats.key !== "derived-stats") {
        await transaction.done;
        return changedInAnotherTab();
      }

      await todos.delete(id);
      const promotedTodoIds = current.status === "active"
        ? await promoteOldestStandbyTodos(transaction, stats.lifetimeXp, this.#clock())
        : [];

      await transaction.done;

      return {
        ok: true,
        deletedTodo: current,
        retainedAward: retainedAward !== undefined,
        promotedTodoIds,
        projection: await this.getProjection(),
      };
    } catch {
      return writeFailed();
    }
  }

  async restoreDeletedTodo(snapshot: TodoRecord): Promise<MutationResult> {
    const database = this.#requireDatabase();

    try {
      const transaction = database.transaction("todos", "readwrite");
      void transaction.done.catch(() => undefined);
      const todos = transaction.objectStore("todos");

      if (await todos.get(snapshot.id)) {
        await transaction.done;
        return changedInAnotherTab();
      }

      await todos.add(snapshot);
      await transaction.done;

      return { ok: true, todo: snapshot, projection: await this.getProjection() };
    } catch (error) {
      return isConstraintError(error) ? changedInAnotherTab() : writeFailed();
    }
  }

  async eraseLocalData(
    confirmation: EraseConfirmation,
  ): Promise<EraseLocalDataResult> {
    if (!confirmation.confirmed) {
      return { ok: false, category: "cancelled" };
    }

    let database = this.#database;
    if (!database) {
      const opened = await openVersionedDatabase({
        name: this.#databaseName,
        createdAt: this.#clock(),
      });
      if (!opened.ok) {
        return this.#deleteAndRecreateDatabase();
      }
      database = opened.database;
    }

    if (!hasExpectedDatabaseStructure(database)) {
      database.close();
      this.#database = null;
      return this.#deleteAndRecreateDatabase();
    }

    const erasure = await eraseDatabaseContents(database, this.#clock());
    if (!erasure.ok) {
      if (database !== this.#database) {
        database.close();
      }
      return eraseFailed(erasure.category);
    }

    this.#database = database;
    this.#clearDraft();
    try {
      const projection = await this.getProjection();
      return { ok: true, projection };
    } catch {
      this.close();
      return eraseFailed("projection-failed");
    }
  }

  close(): void {
    this.#database?.close();
    this.#database = null;
  }

  async #commitCompletionMutation(
    id: string,
    completed: boolean,
  ): Promise<CommittedCompletionMutation | ChangedInAnotherTabFailure> {
    const database = this.#requireDatabase();
    const transaction = database.transaction(
      ["todos", "completionAwards", "meta"],
      "readwrite",
    );
    void transaction.done.catch(() => undefined);
    const todos = transaction.objectStore("todos");
    const awards = transaction.objectStore("completionAwards");
    const meta = transaction.objectStore("meta");
    const current = await todos.get(id);

    if (!current) {
      await transaction.done;
      return changedInAnotherTab();
    }

    if (!completed) {
      if (current.status !== "completed") {
        await transaction.done;
        return {
          ok: true,
          action: "reopened",
          changed: false,
          todo: current,
          award: null,
          xpGained: 0,
          alreadyCredited: false,
          promotedTodoIds: [],
        };
      }

      const retainedAward = await awards.get(id);
      if (!retainedAward) {
        await transaction.done;
        return changedInAnotherTab();
      }

      const timestamp = this.#clock();
      const reopened: TodoRecord = {
        ...current,
        status: "active",
        completionOrder: null,
        updatedAt: timestamp,
        completedAt: null,
      };
      await todos.put(reopened);
      await transaction.done;

      return {
        ok: true,
        action: "reopened",
        changed: true,
        todo: reopened,
        award: null,
        xpGained: 0,
        alreadyCredited: false,
        promotedTodoIds: [],
      };
    }

    const existingAward = await awards.get(id);
    if (current.status === "completed") {
      if (!existingAward) {
        await transaction.done;
        return changedInAnotherTab();
      }

      await transaction.done;
      return {
        ok: true,
        action: "completed",
        changed: false,
        todo: current,
        award: null,
        xpGained: 0,
        alreadyCredited: true,
        promotedTodoIds: [],
      };
    }

    const [core, stats] = await Promise.all([
      meta.get("core"),
      meta.get("derived-stats"),
    ]);
    if (!core || core.key !== "core" || !stats || stats.key !== "derived-stats") {
      await transaction.done;
      return changedInAnotherTab();
    }

    const timestamp = this.#clock();
    let newAward: CompletionAwardRecord | null = null;
    let lifetimeXp = stats.lifetimeXp;
    let awardCount = stats.awardCount;

    if (!existingAward) {
      const calendarDate = this.#calendar(timestamp);
      const currentDayKey = toDayKey(calendarDate);
      const awardIndex = awards.index("by-day-key");
      const [todayAwards, yesterdayAward] = await Promise.all([
        awardIndex.getAll(currentDayKey),
        awardIndex.get(previousDayKey(calendarDate)),
      ]);
      newAward = calculateCompletionAward({
        todoId: id,
        awardedAt: timestamp,
        localDate: calendarDate,
        existingAwards: yesterdayAward ? [...todayAwards, yesterdayAward] : todayAwards,
      });
      await awards.add(newAward);
      lifetimeXp += newAward.totalXp;
      awardCount += 1;
    }

    const completedTodo: TodoRecord = {
      ...current,
      status: "completed",
      completionOrder: core.nextCompletionOrder,
      updatedAt: timestamp,
      completedAt: timestamp,
    };
    await todos.put(completedTodo);

    const promotedTodoIds = await promoteOldestStandbyTodos(
      transaction,
      lifetimeXp,
      timestamp,
    );

    await Promise.all([
      meta.put({ ...core, nextCompletionOrder: core.nextCompletionOrder + 1 }),
      meta.put({ key: "derived-stats", lifetimeXp, awardCount }),
    ]);
    await transaction.done;

    return {
      ok: true,
      action: "completed",
      changed: true,
      todo: completedTodo,
      award: newAward,
      xpGained: newAward?.totalXp ?? 0,
      alreadyCredited: existingAward !== undefined,
      promotedTodoIds,
    };
  }

  async #deleteAndRecreateDatabase(): Promise<EraseLocalDataResult> {
    this.close();
    const deletion = await deleteAppDatabase(this.#databaseName);
    if (!deletion.ok) {
      return eraseFailed(deletion.category);
    }

    const startup = await this.initialize();
    if (!startup.ok) {
      return eraseFailed("recreate-failed");
    }

    this.#clearDraft();
    return startup;
  }

  #requireDatabase(): IDBPDatabase<MechaTodoDatabase> {
    if (!this.#database) {
      throw new Error("Repository has not been initialized.");
    }
    return this.#database;
  }
}

function statusRange(status: TodoStatus): IDBKeyRange {
  return IDBKeyRange.bound([status], [status, []]);
}

async function promoteOldestStandbyTodos(
  transaction: MutationTransaction,
  lifetimeXp: number,
  timestamp: number,
): Promise<string[]> {
  const todos = transaction.objectStore("todos");
  const index = todos.index("by-status-creation-order");
  const capacity = activeCapacity(progressionForTotalXp(lifetimeXp).level);
  const activeCount = await index.count(statusRange("active"));
  const availableSlots = Math.max(0, capacity - activeCount);
  const promotedTodoIds: string[] = [];
  let standbyCursor = await index.openCursor(statusRange("standby"), "next");

  while (standbyCursor && promotedTodoIds.length < availableSlots) {
    const promoted: TodoRecord = {
      ...standbyCursor.value,
      status: "active",
      updatedAt: timestamp,
    };
    await standbyCursor.update(promoted);
    promotedTodoIds.push(promoted.id);
    standbyCursor = await standbyCursor.continue();
  }

  return promotedTodoIds;
}

async function readRewardHudState(
  transaction: ProjectionTransaction,
  calendarDate: LocalCalendarDate,
): Promise<RewardHudState> {
  const awardIndex = transaction.objectStore("completionAwards").index("by-day-key");
  const [todayAwards, yesterdayAward] = await Promise.all([
    awardIndex.getAll(toDayKey(calendarDate)),
    awardIndex.get(previousDayKey(calendarDate)),
  ]);
  const current = todayAwards.length;
  const comboTargets = new Map<number, 5 | 10 | 15 | 20>([
    [4, 5],
    [9, 10],
    [14, 15],
    [19, 20],
  ]);
  const target = comboTargets.get(current);

  return Object.freeze({
    link: todayAwards.some((award) => award.linkBonus > 0)
      ? "active"
      : current === 0 && yesterdayAward
        ? "ready"
        : null,
    combo: target
      ? Object.freeze({ current: current as 4 | 9 | 14 | 19, target })
      : null,
  });
}

async function readStandbyPage(
  transaction: ProjectionTransaction,
  after?: TodoPageCursor,
): Promise<TodoPage> {
  const index = transaction.objectStore("todos").index("by-status-creation-order");
  const range = after
    ? IDBKeyRange.bound(["standby", after.order, after.id], ["standby", []], true)
    : statusRange("standby");
  const items: TodoRecord[] = [];
  let cursor = await index.openCursor(range, "next");

  while (cursor && items.length < TODO_PAGE_SIZE + 1) {
    items.push(cursor.value);
    if (items.length === TODO_PAGE_SIZE + 1) {
      break;
    }
    cursor = await cursor.continue();
  }

  return pageFromItems(items, "creationOrder");
}

async function readCompletedPage(
  transaction: ProjectionTransaction,
  before?: TodoPageCursor,
): Promise<TodoPage> {
  const index = transaction.objectStore("todos").index("by-status-completion-order");
  const range = before
    ? IDBKeyRange.bound(["completed"], ["completed", before.order, before.id], false, true)
    : statusRange("completed");
  const items: TodoRecord[] = [];
  let cursor = await index.openCursor(range, "prev");

  while (cursor && items.length < TODO_PAGE_SIZE + 1) {
    items.push(cursor.value);
    if (items.length === TODO_PAGE_SIZE + 1) {
      break;
    }
    cursor = await cursor.continue();
  }

  return pageFromItems(items, "completionOrder");
}

function pageFromItems(
  readItems: TodoRecord[],
  orderField: "creationOrder" | "completionOrder",
): TodoPage {
  const hasMore = readItems.length > TODO_PAGE_SIZE;
  const items = hasMore ? readItems.slice(0, TODO_PAGE_SIZE) : readItems;
  const last = items.at(-1);
  const order = last?.[orderField];

  return Object.freeze({
    items,
    hasMore,
    nextCursor:
      hasMore && last && order !== null && order !== undefined ? { order, id: last.id } : null,
  });
}

function emptyTodoPage(): TodoPage {
  return Object.freeze({ items: [], hasMore: false, nextCursor: null });
}

function changedInAnotherTab(): ChangedInAnotherTabFailure {
  return {
    ok: false,
    category: "changed-in-another-tab",
    message: LIST_CHANGED_MESSAGE,
  };
}

function writeFailed(): WriteFailure {
  return { ok: false, category: "write-failed", message: "Task could not be saved. Retry." };
}

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

function localDataProblem(
  technicalCategory: LocalDataTechnicalCategory,
): Extract<StartupResult, { category: "local-data" }> {
  return {
    ok: false,
    category: "local-data",
    technicalCategory,
    message: "Local data could not be opened.",
    retryable: true,
  };
}

function eraseFailed(
  technicalCategory: LocalDataTechnicalCategory,
): Extract<EraseLocalDataResult, { category: "local-data" }> {
  return {
    ok: false,
    category: "local-data",
    technicalCategory,
    message: "Local data could not be opened.",
  };
}
