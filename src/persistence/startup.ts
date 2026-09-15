import type { IDBPDatabase, IDBPTransaction } from "idb";
import { REWARD_RULES_V1 } from "../config/rules-v1";
import type { MechaTodoDatabase } from "./db-schema";

export type DatabaseErasureResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; category: "erase-transaction-failed" }>;

export async function eraseDatabaseContents(
  database: IDBPDatabase<MechaTodoDatabase>,
  createdAt: number,
): Promise<DatabaseErasureResult> {
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
    const todos = transaction.objectStore("todos");
    const awards = transaction.objectStore("completionAwards");
    const meta = transaction.objectStore("meta");

    await Promise.all([todos.clear(), awards.clear(), meta.clear()]);
    if (!Number.isSafeInteger(createdAt) || createdAt < 0) {
      throw new RangeError("Fresh database metadata requires a safe timestamp.");
    }
    await Promise.all([
      meta.add({
        key: "core",
        createdAt,
        rulesVersion: REWARD_RULES_V1.rulesVersion,
        nextCreationOrder: 0,
        nextCompletionOrder: 0,
      }),
      meta.add({ key: "derived-stats", lifetimeXp: 0, awardCount: 0 }),
    ]);
    await transaction.done;

    return { ok: true };
  } catch {
    try {
      transaction?.abort();
    } catch {
      // The transaction may already have aborted or committed.
    }
    await transaction?.done.catch(() => undefined);
    return { ok: false, category: "erase-transaction-failed" };
  }
}
