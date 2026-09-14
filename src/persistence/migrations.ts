import type { IDBPDatabase, IDBPTransaction } from "idb";
import { REWARD_RULES_V1 } from "../config/rules-v1";
import type { MechaTodoDatabase } from "./db-schema";

export const DATABASE_VERSION = 1;

type VersionChangeTransaction = IDBPTransaction<
  MechaTodoDatabase,
  ("todos" | "completionAwards" | "meta")[],
  "versionchange"
>;

export function applyMigrations(
  database: IDBPDatabase<MechaTodoDatabase>,
  oldVersion: number,
  newVersion: number | null,
  transaction: VersionChangeTransaction,
  createdAt: number,
): void {
  switch (oldVersion) {
    case 0:
      createVersionOne(database, transaction, createdAt);
      break;
    default:
      throw new Error(`No migration starts at database version ${oldVersion}.`);
  }

  if (newVersion !== DATABASE_VERSION) {
    throw new Error(`Database version ${String(newVersion)} is not supported.`);
  }
}

function createVersionOne(
  database: IDBPDatabase<MechaTodoDatabase>,
  transaction: VersionChangeTransaction,
  createdAt: number,
): void {
  const todos = database.createObjectStore("todos", { keyPath: "id" });
  todos.createIndex("by-status-creation-order", ["status", "creationOrder", "id"]);
  todos.createIndex("by-status-completion-order", ["status", "completionOrder", "id"]);
  todos.createIndex("by-creation-order", "creationOrder", { unique: true });
  todos.createIndex("by-completion-order", "completionOrder", { unique: true });

  const completionAwards = database.createObjectStore("completionAwards", {
    keyPath: "todoId",
  });
  completionAwards.createIndex("by-day-key", "dayKey");
  completionAwards.createIndex("by-awarded-at", "awardedAt");
  completionAwards.createIndex("by-day-ordinal", ["dayKey", "dailyOrdinal"], {
    unique: true,
  });

  database.createObjectStore("meta", { keyPath: "key" });
  const meta = transaction.objectStore("meta");
  void meta
    .put({
      key: "core",
      createdAt,
      rulesVersion: REWARD_RULES_V1.rulesVersion,
      nextCreationOrder: 0,
      nextCompletionOrder: 0,
    })
    .catch(() => undefined);
  void meta
    .put({ key: "derived-stats", lifetimeXp: 0, awardCount: 0 })
    .catch(() => undefined);
}
