import { openDB, type IDBPDatabase } from "idb";
import { DATABASE_NAME, PRODUCT_NAME } from "../config/product";
import type { MechaTodoDatabase } from "./db-schema";
import { applyMigrations, DATABASE_VERSION } from "./migrations";

export type DatabaseOpenResult =
  | Readonly<{ ok: true; database: IDBPDatabase<MechaTodoDatabase> }>
  | Readonly<{
      ok: false;
      category: "blocked" | "migration-failed" | "open-failed";
      retryable: true;
      message: string;
    }>;

export type DatabaseDeleteResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      category: "delete-blocked" | "delete-failed";
    }>;

type OpenDatabaseOptions = Readonly<{
  name?: string;
  version?: number;
  createdAt?: number;
}>;

export function openAppDatabase(): Promise<DatabaseOpenResult> {
  return openVersionedDatabase();
}

export function openVersionedDatabase({
  name = DATABASE_NAME,
  version = DATABASE_VERSION,
  createdAt = Date.now(),
}: OpenDatabaseOptions = {}): Promise<DatabaseOpenResult> {
  return new Promise((resolve) => {
    let settled = false;
    let migrationFailed = false;

    const finish = (result: DatabaseOpenResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const opening = openDB<MechaTodoDatabase>(name, version, {
      upgrade(database, oldVersion, newVersion, transaction) {
        try {
          applyMigrations(database, oldVersion, newVersion, transaction, createdAt);
        } catch {
          migrationFailed = true;
          void transaction.done.catch(() => undefined);
          transaction.abort();
        }
      },
      blocked() {
        finish({
          ok: false,
          category: "blocked",
          retryable: true,
          message: `Close ${PRODUCT_NAME} in other tabs, then retry.`,
        });
      },
      blocking() {
        void opening.then((database) => database.close());
      },
    });

    void opening.then(
      (database) => {
        if (settled) {
          database.close();
          return;
        }
        finish({ ok: true, database });
      },
      () => {
        finish({
          ok: false,
          category: migrationFailed ? "migration-failed" : "open-failed",
          retryable: true,
          message: "Local data could not be opened.",
        });
      },
    );
  });
}

export function deleteAppDatabase(name = DATABASE_NAME): Promise<DatabaseDeleteResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: DatabaseDeleteResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => finish({ ok: true });
      request.onerror = () => finish({ ok: false, category: "delete-failed" });
      request.onblocked = () => finish({ ok: false, category: "delete-blocked" });
    } catch {
      finish({ ok: false, category: "delete-failed" });
    }
  });
}
