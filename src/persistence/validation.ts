import type { IDBPDatabase, IDBPTransaction } from "idb";
import type { MechaTodoDatabase } from "./db-schema";
import { DATABASE_VERSION } from "./migrations";
import {
  validateAuthoritativeRecords,
  type RecordsValidationResult,
  type ValidatedRecords,
} from "./schemas";

const STORE_NAMES = ["completionAwards", "meta", "todos"] as const;

export type StartupPreparationResult =
  | Readonly<{ ok: true; value: ValidatedRecords }>
  | Exclude<RecordsValidationResult, Readonly<{ ok: true; value: ValidatedRecords }>>
  | Readonly<{
      ok: false;
      category: "invalid-database-schema" | "unsafe-counter" | "metadata-rebuild-failed";
    }>;

export async function validateDatabaseContents(
  database: IDBPDatabase<MechaTodoDatabase>,
): Promise<RecordsValidationResult> {
  const transaction = database.transaction(
    ["todos", "completionAwards", "meta"],
    "readonly",
  );
  const [todos, completionAwards, meta] = await Promise.all([
    transaction.objectStore("todos").getAll(),
    transaction.objectStore("completionAwards").getAll(),
    transaction.objectStore("meta").getAll(),
  ]);
  await transaction.done;

  return validateAuthoritativeRecords({ todos, completionAwards, meta });
}

export async function prepareDatabaseForStartup(
  database: IDBPDatabase<MechaTodoDatabase>,
): Promise<StartupPreparationResult> {
  if (!hasExpectedDatabaseStructure(database)) {
    return { ok: false, category: "invalid-database-schema" };
  }

  let transaction:
    | IDBPTransaction<
        MechaTodoDatabase,
        ("todos" | "completionAwards" | "meta")[],
        "readwrite"
      >
    | undefined;

  try {
    transaction = database.transaction(
      ["todos", "completionAwards", "meta"],
      "readwrite",
    );
    void transaction.done.catch(() => undefined);
    const [todos, completionAwards, meta] = await Promise.all([
      transaction.objectStore("todos").getAll(),
      transaction.objectStore("completionAwards").getAll(),
      transaction.objectStore("meta").getAll(),
    ]);
    const validation = validateAuthoritativeRecords({ todos, completionAwards, meta });

    if (!validation.ok) {
      await transaction.done;
      return validation;
    }

    const nextCreationOrder = nextOrder(
      validation.value.todos.map((todo) => todo.creationOrder),
    );
    const nextCompletionOrder = nextOrder(
      validation.value.todos.flatMap((todo) => todo.completionOrder ?? []),
    );
    if (nextCreationOrder === null || nextCompletionOrder === null) {
      transaction.abort();
      await transaction.done.catch(() => undefined);
      return { ok: false, category: "unsafe-counter" };
    }

    const lifetimeXp = validation.value.completionAwards.reduce(
      (total, award) => total + award.totalXp,
      0,
    );
    const awardCount = validation.value.completionAwards.length;
    const coreMatches =
      validation.value.core.nextCreationOrder === nextCreationOrder &&
      validation.value.core.nextCompletionOrder === nextCompletionOrder;
    const statsMatch =
      validation.value.derivedStats?.lifetimeXp === lifetimeXp &&
      validation.value.derivedStats.awardCount === awardCount;

    if (!coreMatches || !statsMatch) {
      const metaStore = transaction.objectStore("meta");
      await Promise.all([
        metaStore.put({
          ...validation.value.core,
          nextCreationOrder,
          nextCompletionOrder,
        }),
        metaStore.put({ key: "derived-stats", lifetimeXp, awardCount }),
      ]);
    }

    await transaction.done;
    return validation;
  } catch {
    try {
      transaction?.abort();
    } catch {
      // The transaction may already have aborted or committed.
    }
    await transaction?.done.catch(() => undefined);
    return { ok: false, category: "metadata-rebuild-failed" };
  }
}

export function hasExpectedDatabaseStructure(
  database: IDBPDatabase<MechaTodoDatabase>,
): boolean {
  if (
    database.version !== DATABASE_VERSION ||
    !sameStringSet(Array.from(database.objectStoreNames), STORE_NAMES)
  ) {
    return false;
  }

  try {
    const transaction = database.transaction(
      ["todos", "completionAwards", "meta"],
      "readonly",
    );
    const todos = transaction.objectStore("todos");
    const awards = transaction.objectStore("completionAwards");
    const meta = transaction.objectStore("meta");

    return (
      todos.keyPath === "id" &&
      !todos.autoIncrement &&
      meta.keyPath === "key" &&
      !meta.autoIncrement &&
      awards.keyPath === "todoId" &&
      !awards.autoIncrement &&
      meta.indexNames.length === 0 &&
      sameStringSet(Array.from(todos.indexNames), [
        "by-status-creation-order",
        "by-status-completion-order",
        "by-creation-order",
        "by-completion-order",
      ]) &&
      sameStringSet(Array.from(awards.indexNames), [
        "by-day-key",
        "by-awarded-at",
        "by-day-ordinal",
      ]) &&
      indexMatches(todos.index("by-status-creation-order"), [
        "status",
        "creationOrder",
        "id",
      ]) &&
      indexMatches(todos.index("by-status-completion-order"), [
        "status",
        "completionOrder",
        "id",
      ]) &&
      indexMatches(todos.index("by-creation-order"), "creationOrder", true) &&
      indexMatches(todos.index("by-completion-order"), "completionOrder", true) &&
      indexMatches(awards.index("by-day-key"), "dayKey") &&
      indexMatches(awards.index("by-awarded-at"), "awardedAt") &&
      indexMatches(awards.index("by-day-ordinal"), ["dayKey", "dailyOrdinal"], true)
    );
  } catch {
    return false;
  }
}

function nextOrder(orders: readonly number[]): number | null {
  const highest = orders.reduce((maximum, order) => Math.max(maximum, order), -1);
  return highest >= Number.MAX_SAFE_INTEGER ? null : highest + 1;
}

function indexMatches(
  index: Readonly<{ unique: boolean; keyPath: string | string[] }>,
  keyPath: string | readonly string[],
  unique = false,
): boolean {
  return index.unique === unique && sameKeyPath(index.keyPath, keyPath);
}

function sameKeyPath(
  actual: string | string[] | null,
  expected: string | readonly string[],
): boolean {
  if (typeof expected === "string") {
    return actual === expected;
  }
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((part, index) => part === expected[index])
  );
}

function sameStringSet(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  const sortedExpected = [...expected].sort();
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === sortedExpected[index])
  );
}
