import { expect, test } from "@playwright/test";

const databaseModulePath = "/src/persistence/db.ts";
const validationModulePath = "/src/persistence/validation.ts";

test("creates exactly the V1 stores, indexes, and initial metadata", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, validationPath }) => {
      const databaseModule = await import(databasePath);
      const validationModule = await import(validationPath);
      const opened = await databaseModule.openAppDatabase();

      if (!opened.ok) {
        return opened;
      }

      const database = opened.database;
      const transaction = database.transaction(["todos", "completionAwards", "meta"], "readonly");
      const describeIndex = (storeName: "todos" | "completionAwards", indexName: string) => {
        const index = transaction.objectStore(storeName).index(indexName);
        return { keyPath: index.keyPath, unique: index.unique };
      };
      const todoIndexes = {
          statusCreation: describeIndex("todos", "by-status-creation-order"),
          statusCompletion: describeIndex("todos", "by-status-completion-order"),
          creation: describeIndex("todos", "by-creation-order"),
          completion: describeIndex("todos", "by-completion-order"),
      };
      const awardIndexes = {
          day: describeIndex("completionAwards", "by-day-key"),
          awardedAt: describeIndex("completionAwards", "by-awarded-at"),
          ordinal: describeIndex("completionAwards", "by-day-ordinal"),
      };
      const metadata = await transaction.objectStore("meta").getAll();
      await transaction.done;
      const validation = await validationModule.validateDatabaseContents(database);
      const description = {
        ok: true,
        name: database.name,
        version: database.version,
        stores: Array.from(database.objectStoreNames).sort(),
        todoIndexes,
        awardIndexes,
        metadata,
        validation,
      };
      database.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(database.name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return description;
    },
    { databasePath: databaseModulePath, validationPath: validationModulePath },
  );

  expect(result).toEqual({
    ok: true,
    name: "mecha-todo",
    version: 1,
    stores: ["completionAwards", "meta", "todos"],
    todoIndexes: {
      statusCreation: { keyPath: ["status", "creationOrder", "id"], unique: false },
      statusCompletion: { keyPath: ["status", "completionOrder", "id"], unique: false },
      creation: { keyPath: "creationOrder", unique: true },
      completion: { keyPath: "completionOrder", unique: true },
    },
    awardIndexes: {
      day: { keyPath: "dayKey", unique: false },
      awardedAt: { keyPath: "awardedAt", unique: false },
      ordinal: { keyPath: ["dayKey", "dailyOrdinal"], unique: true },
    },
    metadata: [
      {
        key: "core",
        createdAt: expect.any(Number),
        rulesVersion: 1,
        nextCreationOrder: 0,
        nextCompletionOrder: 0,
      },
      { key: "derived-stats", lifetimeXp: 0, awardCount: 0 },
    ],
    validation: {
      ok: true,
      value: {
        todos: [],
        completionAwards: [],
        core: {
          key: "core",
          createdAt: expect.any(Number),
          rulesVersion: 1,
          nextCreationOrder: 0,
          nextCompletionOrder: 0,
        },
        derivedStats: { key: "derived-stats", lifetimeXp: 0, awardCount: 0 },
      },
    },
  });
});

test("reports a blocked upgrade as retryable", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async (databasePath) => {
    const databaseModule = await import(databasePath);
    const name = `mecha-todo-blocked-${crypto.randomUUID()}`;
    const blocker = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("sentinel");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const opened = await databaseModule.openVersionedDatabase({ name, version: 2, createdAt: 0 });
    blocker.close();

    await new Promise((resolve) => setTimeout(resolve, 50));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Cleanup was blocked."));
    });
    return opened;
  }, databaseModulePath);

  expect(result).toEqual({
    ok: false,
    category: "blocked",
    retryable: true,
    message: "Close MECHA//TODO in other tabs, then retry.",
  });
});

test("closes an older connection when a version change starts", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async (databasePath) => {
    const databaseModule = await import(databasePath);
    const name = `mecha-todo-versionchange-${crypto.randomUUID()}`;
    const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 0 });
    if (!opened.ok) {
      return opened;
    }

    const olderConnection = opened.database;
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("The older connection stayed open."));
    });

    let olderConnectionClosed = false;
    try {
      olderConnection.transaction("meta", "readonly");
    } catch (error) {
      olderConnectionClosed = error instanceof DOMException && error.name === "InvalidStateError";
    }

    upgraded.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return { ok: true, olderConnectionClosed };
  }, databaseModulePath);

  expect(result).toEqual({ ok: true, olderConnectionClosed: true });
});

test("rolls back a failed migration transaction", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async (databasePath) => {
    const databaseModule = await import(databasePath);
    const name = `mecha-todo-rollback-${crypto.randomUUID()}`;
    const failed = await databaseModule.openVersionedDatabase({ name, version: 2, createdAt: 0 });
    let storesBeforeRecovery: string[] = [];

    const recovered = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        storesBeforeRecovery = Array.from(request.result.objectStoreNames);
        request.result.createObjectStore("sentinel");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    recovered.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return { failed, storesBeforeRecovery };
  }, databaseModulePath);

  expect(result).toEqual({
    failed: {
      ok: false,
      category: "migration-failed",
      retryable: true,
      message: "Local data could not be opened.",
    },
    storesBeforeRecovery: [],
  });
});

test("rejects malformed authoritative records in the database", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, validationPath }) => {
      const databaseModule = await import(databasePath);
      const validationModule = await import(validationPath);
      const name = `mecha-todo-invalid-${crypto.randomUUID()}`;
      const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 0 });
      if (!opened.ok) {
        return opened;
      }

      await opened.database.put("todos", {
        id: "todo-1",
        text: "Invalid completion",
        status: "completed",
        creationOrder: 0,
        completionOrder: null,
        createdAt: 0,
        updatedAt: 0,
        completedAt: null,
      });
      const validation = await validationModule.validateDatabaseContents(opened.database);
      opened.database.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return validation;
    },
    { databasePath: databaseModulePath, validationPath: validationModulePath },
  );

  expect(result).toEqual({ ok: false, category: "invalid-todo" });
});
