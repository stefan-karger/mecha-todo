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
import { openVersionedDatabase } from "./db";
import type { MechaTodoDatabase } from "./db-schema";
import type {
  CoreMetaRecord,
  CompletionAwardRecord,
  DerivedStatsMetaRecord,
  TodoRecord,
  TodoStatus,
} from "./models";
import { validateDatabaseContents } from "./validation";

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

export type AppProjection = Readonly<{
  activeTodos: TodoRecord[];
  standbyTodos: TodoPage;
  completedTodos: TodoPage;
  lifetimeXp: number;
  progression: Progression;
  rank: string;
  activeCapacity: number;
}>;

export type StartupResult =
  | Readonly<{ ok: true; projection: AppProjection }>
  | Readonly<{
      ok: false;
      category:
        | "blocked"
        | "migration-failed"
        | "open-failed"
        | "invalid-todo"
        | "invalid-award"
        | "invalid-meta"
        | "inconsistent-records";
      message: string;
      retryable: boolean;
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
  initialize(): Promise<StartupResult>;
  getProjection(query?: ProjectionQuery): Promise<AppProjection>;
  addTodo(text: string): Promise<MutationResult>;
  editTodo(id: string, text: string): Promise<MutationResult>;
  setTodoCompleted(id: string, completed: boolean): Promise<CompletionMutationResult>;
  deleteTodo(id: string): Promise<DeleteMutationResult>;
  restoreDeletedTodo(snapshot: TodoRecord): Promise<MutationResult>;
  close(): void;
}

type RepositoryOptions = Readonly<{
  databaseName?: string;
  clock?: () => number;
  idFactory?: () => string;
  calendar?: (timestamp: number) => LocalCalendarDate;
}>;

type CommittedCompletionMutation = Omit<CompletionMutationSuccess, "projection">;

type ProjectionTransaction = IDBPTransaction<
  MechaTodoDatabase,
  ("todos" | "completionAwards" | "meta")[],
  "readonly"
>;

export class IndexedDbAppRepository implements AppRepository {
  readonly #databaseName: string;
  readonly #clock: () => number;
  readonly #idFactory: () => string;
  readonly #calendar: (timestamp: number) => LocalCalendarDate;
  #database: IDBPDatabase<MechaTodoDatabase> | null = null;

  constructor({
    databaseName = DATABASE_NAME,
    clock = Date.now,
    idFactory = createTodoId,
    calendar = (timestamp) => localCalendarDate(new Date(timestamp)),
  }: RepositoryOptions = {}) {
    this.#databaseName = databaseName;
    this.#clock = clock;
    this.#idFactory = idFactory;
    this.#calendar = calendar;
  }

  async initialize(): Promise<StartupResult> {
    if (this.#database) {
      return { ok: true, projection: await this.getProjection() };
    }

    const opened = await openVersionedDatabase({
      name: this.#databaseName,
      createdAt: this.#clock(),
    });
    if (!opened.ok) {
      return opened;
    }

    const validation = await validateDatabaseContents(opened.database);
    if (!validation.ok) {
      opened.database.close();
      return {
        ok: false,
        category: validation.category,
        message: "Local data could not be opened.",
        retryable: true,
      };
    }

    this.#database = opened.database;
    await this.#rebuildMetadata(validation.value);

    return { ok: true, projection: await this.getProjection() };
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
    const statsPromise = transaction.objectStore("meta").get("derived-stats");
    const [activeTodos, standbyTodos, completedTodos, stats] = await Promise.all([
      activeTodosPromise,
      standbyTodosPromise,
      completedTodosPromise,
      statsPromise,
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
      lifetimeXp: stats.lifetimeXp,
      progression,
      rank: rankForLevel(progression.level),
      activeCapacity: activeCapacity(progression.level),
    });
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
      const promotedTodoIds: string[] = [];

      if (current.status === "active") {
        const timestamp = this.#clock();
        const capacity = activeCapacity(progressionForTotalXp(stats.lifetimeXp).level);
        const activeCount = await todos
          .index("by-status-creation-order")
          .count(statusRange("active"));
        const availableSlots = Math.max(0, capacity - activeCount);
        let standbyCursor = await todos
          .index("by-status-creation-order")
          .openCursor(statusRange("standby"), "next");

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
      }

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

    const capacity = activeCapacity(progressionForTotalXp(lifetimeXp).level);
    const activeCount = await todos
      .index("by-status-creation-order")
      .count(statusRange("active"));
    const availableSlots = Math.max(0, capacity - activeCount);
    const promotedTodoIds: string[] = [];
    let standbyCursor = await todos
      .index("by-status-creation-order")
      .openCursor(statusRange("standby"), "next");

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

  async #rebuildMetadata(records: {
    todos: TodoRecord[];
    completionAwards: { totalXp: number }[];
    core: CoreMetaRecord;
    derivedStats: DerivedStatsMetaRecord | null;
  }): Promise<void> {
    const nextCreationOrder = nextOrder(records.todos.map((todo) => todo.creationOrder));
    const nextCompletionOrder = nextOrder(
      records.todos.flatMap((todo) => todo.completionOrder ?? []),
    );
    const lifetimeXp = records.completionAwards.reduce((total, award) => total + award.totalXp, 0);
    const awardCount = records.completionAwards.length;
    const coreMatches =
      records.core.nextCreationOrder === nextCreationOrder &&
      records.core.nextCompletionOrder === nextCompletionOrder;
    const statsMatch =
      records.derivedStats?.lifetimeXp === lifetimeXp &&
      records.derivedStats.awardCount === awardCount;

    if (coreMatches && statsMatch) {
      return;
    }

    const database = this.#requireDatabase();
    const transaction = database.transaction("meta", "readwrite");
    const meta = transaction.objectStore("meta");
    await Promise.all([
      meta.put({ ...records.core, nextCreationOrder, nextCompletionOrder }),
      meta.put({ key: "derived-stats", lifetimeXp, awardCount }),
    ]);
    await transaction.done;
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

function nextOrder(orders: readonly number[]): number {
  return orders.reduce((highest, order) => Math.max(highest, order), -1) + 1;
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
