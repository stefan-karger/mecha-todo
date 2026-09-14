import type { IDBPDatabase } from "idb";
import type { MechaTodoDatabase } from "./db-schema";
import {
  validateAuthoritativeRecords,
  type RecordsValidationResult,
} from "./schemas";

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
