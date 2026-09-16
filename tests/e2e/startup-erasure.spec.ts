import { expect, test } from "@playwright/test";

const databaseModulePath = "http://127.0.0.1:4174/db.js";
const repositoryModulePath = "http://127.0.0.1:4174/repository.js";
const startupModulePath = "http://127.0.0.1:4174/startup.js";

test("validates and rebuilds safe metadata before returning the authoritative projection", async ({
  page,
}) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-startup-${crypto.randomUUID()}`;
      const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 1 });
      if (!opened.ok) {
        return opened;
      }

      const transaction = opened.database.transaction(
        ["todos", "completionAwards", "meta"],
        "readwrite",
      );
      await transaction.objectStore("todos").add({
        id: "stored-todo",
        text: "Stored task",
        status: "completed",
        creationOrder: 4,
        completionOrder: 7,
        createdAt: 2,
        updatedAt: 3,
        completedAt: 3,
      });
      await transaction.objectStore("completionAwards").add({
        todoId: "stored-todo",
        awardedAt: 3,
        dayKey: "2026-09-15",
        dailyOrdinal: 1,
        baseXp: 10,
        linkBonus: 0,
        comboBonus: 0,
        totalXp: 10,
        rulesVersion: 1,
      });
      await transaction.objectStore("meta").put({
        key: "core",
        createdAt: 1,
        rulesVersion: 1,
        nextCreationOrder: 99,
        nextCompletionOrder: 99,
      });
      await transaction.objectStore("meta").put({
        key: "derived-stats",
        lifetimeXp: 0,
        awardCount: 0,
      });
      await transaction.done;
      opened.database.close();

      const repository = new IndexedDbAppRepository({ databaseName: name });
      let settled = false;
      const startupPromise = repository.initialize().then((startup: unknown) => {
        settled = true;
        return startup;
      });
      const settledSynchronously = settled;
      const startup = await startupPromise;

      const inspection = await databaseModule.openVersionedDatabase({ name });
      if (!inspection.ok) {
        return inspection;
      }
      const metadata = await inspection.database.getAll("meta");
      inspection.database.close();
      repository.close();
      await deleteDatabase(name);

      return { settledSynchronously, startup, metadata };

      function deleteDatabase(databaseName: string): Promise<void> {
        return new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(databaseName);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.settledSynchronously).toBe(false);
  expect(result.startup).toMatchObject({
    ok: true,
    projection: {
      activeTodos: [],
      completedTodos: { items: [{ id: "stored-todo", text: "Stored task" }] },
      lifetimeXp: 10,
      progression: { level: 1 },
      rank: "Cadet",
      activeCapacity: 8,
    },
  });
  expect(result.metadata).toEqual([
    {
      key: "core",
      createdAt: 1,
      rulesVersion: 1,
      nextCreationOrder: 5,
      nextCompletionOrder: 8,
    },
    { key: "derived-stats", lifetimeXp: 10, awardCount: 1 },
  ]);
});

test("maps untrusted data to one task-free local-data result without deleting it", async ({
  page,
}) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);

      const failures: Record<string, unknown> = {};

      const futureName = `mecha-todo-future-${crypto.randomUUID()}`;
      const future = await nativeOpen(futureName, 2, (database) => {
        database.createObjectStore("sentinel");
      });
      await nativePut(future, "sentinel", "keep me", "record");
      future.close();
      const futureRepository = new IndexedDbAppRepository({ databaseName: futureName });
      failures.open = await futureRepository.initialize();
      const futureInspection = await nativeOpen(futureName, 2);
      const futureRecord = await nativeGet(futureInspection, "sentinel", "record");
      futureInspection.close();
      futureRepository.close();

      const schemaName = `mecha-todo-schema-${crypto.randomUUID()}`;
      const wrongSchema = await nativeOpen(schemaName, 1, (database) => {
        database.createObjectStore("sentinel");
      });
      wrongSchema.close();
      const schemaRepository = new IndexedDbAppRepository({ databaseName: schemaName });
      failures.schema = await schemaRepository.initialize();
      schemaRepository.close();

      const invalidTodoName = await createV1Database("invalid-todo");
      const invalidTodoDatabase = await databaseModule.openVersionedDatabase({
        name: invalidTodoName,
      });
      if (!invalidTodoDatabase.ok) return invalidTodoDatabase;
      await invalidTodoDatabase.database.put("todos", {
        id: "secret-todo",
        text: "SECRET  TASK TEXT",
        status: "active",
        creationOrder: 0,
        completionOrder: null,
        createdAt: 1,
        updatedAt: 1,
        completedAt: null,
      });
      invalidTodoDatabase.database.close();
      const invalidTodoRepository = new IndexedDbAppRepository({
        databaseName: invalidTodoName,
      });
      failures.todo = await invalidTodoRepository.initialize();
      invalidTodoRepository.close();

      const invalidAwardName = await createV1Database("invalid-award");
      const invalidAwardDatabase = await databaseModule.openVersionedDatabase({
        name: invalidAwardName,
      });
      if (!invalidAwardDatabase.ok) return invalidAwardDatabase;
      await invalidAwardDatabase.database.put("completionAwards", {
        todoId: "award-todo",
        awardedAt: 1,
        dayKey: "2026-09-15",
        dailyOrdinal: 1,
        baseXp: 11,
        linkBonus: 0,
        comboBonus: 0,
        totalXp: 11,
        rulesVersion: 1,
      });
      invalidAwardDatabase.database.close();
      const invalidAwardRepository = new IndexedDbAppRepository({
        databaseName: invalidAwardName,
      });
      failures.award = await invalidAwardRepository.initialize();
      invalidAwardRepository.close();

      const rulesName = await createV1Database("rules");
      const rulesDatabase = await databaseModule.openVersionedDatabase({ name: rulesName });
      if (!rulesDatabase.ok) return rulesDatabase;
      await rulesDatabase.database.put("meta", {
        key: "core",
        createdAt: 1,
        rulesVersion: 2,
        nextCreationOrder: 0,
        nextCompletionOrder: 0,
      });
      rulesDatabase.database.close();
      const rulesRepository = new IndexedDbAppRepository({ databaseName: rulesName });
      failures.rules = await rulesRepository.initialize();
      rulesRepository.close();

      const unsafeXpName = await createV1Database("unsafe-xp");
      const unsafeXpDatabase = await databaseModule.openVersionedDatabase({ name: unsafeXpName });
      if (!unsafeXpDatabase.ok) return unsafeXpDatabase;
      await unsafeXpDatabase.database.put("meta", {
        key: "derived-stats",
        lifetimeXp: Number.MAX_SAFE_INTEGER + 1,
        awardCount: 0,
      });
      unsafeXpDatabase.database.close();
      const unsafeXpRepository = new IndexedDbAppRepository({ databaseName: unsafeXpName });
      failures.unsafeXp = await unsafeXpRepository.initialize();
      unsafeXpRepository.close();

      const serializedFailures = JSON.stringify(failures);
      for (const name of [
        futureName,
        schemaName,
        invalidTodoName,
        invalidAwardName,
        rulesName,
        unsafeXpName,
      ]) {
        await deleteDatabase(name);
      }

      return { failures, futureRecord, serializedFailures };

      async function createV1Database(label: string): Promise<string> {
        const name = `mecha-todo-${label}-${crypto.randomUUID()}`;
        const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 1 });
        if (!opened.ok) throw new Error(`Could not create ${label} fixture.`);
        opened.database.close();
        return name;
      }

      function nativeOpen(
        name: string,
        version: number,
        upgrade?: (database: IDBDatabase) => void,
      ): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(name, version);
          request.onupgradeneeded = () => upgrade?.(request.result);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }

      function nativePut(
        database: IDBDatabase,
        storeName: string,
        value: unknown,
        key: IDBValidKey,
      ): Promise<void> {
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(storeName, "readwrite");
          transaction.objectStore(storeName).put(value, key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      }

      function nativeGet(
        database: IDBDatabase,
        storeName: string,
        key: IDBValidKey,
      ): Promise<unknown> {
        return new Promise((resolve, reject) => {
          const request = database.transaction(storeName).objectStore(storeName).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }

      function deleteDatabase(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  const expectedFailure = (technicalCategory: string) => ({
    ok: false,
    category: "local-data",
    technicalCategory,
    message: "Local data could not be opened.",
    retryable: true,
  });
  expect(result.failures).toEqual({
    open: expectedFailure("open-failed"),
    schema: expectedFailure("invalid-database-schema"),
    todo: expectedFailure("invalid-todo"),
    award: expectedFailure("invalid-award"),
    rules: expectedFailure("unsupported-rules"),
    unsafeXp: expectedFailure("unsafe-xp"),
  });
  expect(result.futureRecord).toBe("keep me");
  expect(result.serializedFailures).not.toContain("SECRET");
  expect(result.serializedFailures).not.toContain("TASK TEXT");
});

test("Retry reads the same records again and succeeds only after an external correction", async ({
  page,
}) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-retry-${crypto.randomUUID()}`;
      const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 1 });
      if (!opened.ok) return opened;
      await opened.database.put("todos", {
        id: "retry-todo",
        text: "Invalid  spacing",
        status: "active",
        creationOrder: 0,
        completionOrder: null,
        createdAt: 1,
        updatedAt: 1,
        completedAt: null,
      });
      opened.database.close();

      const repository = new IndexedDbAppRepository({ databaseName: name });
      const first = await repository.initialize();
      const unchanged = await databaseModule.openVersionedDatabase({ name });
      if (!unchanged.ok) return unchanged;
      const beforeCorrection = await unchanged.database.get("todos", "retry-todo");
      await unchanged.database.put("todos", { ...beforeCorrection, text: "Valid spacing" });
      unchanged.database.close();

      const retried = await repository.initialize();
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return { first, beforeCorrection, retried };
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.first).toMatchObject({
    ok: false,
    category: "local-data",
    technicalCategory: "invalid-todo",
  });
  expect(result.beforeCorrection.text).toBe("Invalid  spacing");
  expect(result.retried).toMatchObject({
    ok: true,
    projection: { activeTodos: [{ id: "retry-todo", text: "Valid spacing" }] },
  });
});

test("cancelled erasure changes nothing and confirmed erasure is atomic", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath, startupPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const { eraseDatabaseContents } = await import(startupPath);
      const name = `mecha-todo-erase-${crypto.randomUUID()}`;
      const repository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => 100,
        calendar: () => ({ year: 2026, month: 9, day: 15 }),
        idFactory: () => "erase-todo",
      });
      await repository.initialize();
      const added = await repository.addTodo("Keep until confirmed");
      if (!added.ok) return added;
      await repository.setTodoCompleted(added.todo.id, true);
      localStorage.setItem("mecha-todo:composer-draft:v1", "unfinished draft");

      const cancelled = await repository.eraseLocalData({ confirmed: false });
      const afterCancellation = await repository.getProjection();
      const rollbackConnection = await databaseModule.openVersionedDatabase({ name });
      if (!rollbackConnection.ok) return rollbackConnection;
      const rolledBack = await eraseDatabaseContents(rollbackConnection.database, -1);
      const afterRollback = {
        todos: await rollbackConnection.database.getAll("todos"),
        awards: await rollbackConnection.database.getAll("completionAwards"),
        meta: await rollbackConnection.database.getAll("meta"),
      };
      rollbackConnection.database.close();

      const erased = await repository.eraseLocalData({ confirmed: true });
      const inspection = await databaseModule.openVersionedDatabase({ name });
      if (!inspection.ok) return inspection;
      const fresh = {
        todos: await inspection.database.getAll("todos"),
        awards: await inspection.database.getAll("completionAwards"),
        meta: await inspection.database.getAll("meta"),
      };
      inspection.database.close();
      const draft = localStorage.getItem("mecha-todo:composer-draft:v1");
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return { cancelled, afterCancellation, rolledBack, afterRollback, erased, fresh, draft };
    },
    {
      databasePath: databaseModulePath,
      repositoryPath: repositoryModulePath,
      startupPath: startupModulePath,
    },
  );

  expect(result.cancelled).toEqual({ ok: false, category: "cancelled" });
  expect(result.afterCancellation).toMatchObject({
    completedTodos: { items: [{ id: "erase-todo", text: "Keep until confirmed" }] },
    lifetimeXp: 10,
  });
  expect(result.rolledBack).toEqual({ ok: false, category: "erase-transaction-failed" });
  expect(result.afterRollback.todos).toHaveLength(1);
  expect(result.afterRollback.awards).toHaveLength(1);
  expect(result.afterRollback.meta).toEqual([
    {
      key: "core",
      createdAt: 100,
      rulesVersion: 1,
      nextCreationOrder: 1,
      nextCompletionOrder: 1,
    },
    { key: "derived-stats", lifetimeXp: 10, awardCount: 1 },
  ]);
  expect(result.erased).toMatchObject({
    ok: true,
    projection: {
      activeTodos: [],
      standbyTodos: { items: [] },
      completedTodos: { items: [] },
      lifetimeXp: 0,
      progression: { level: 0 },
      rank: "Cadet",
    },
  });
  expect(result.fresh).toEqual({
    todos: [],
    awards: [],
    meta: [
      {
        key: "core",
        createdAt: 100,
        rulesVersion: 1,
        nextCreationOrder: 0,
        nextCompletionOrder: 0,
      },
      { key: "derived-stats", lifetimeXp: 0, awardCount: 0 },
    ],
  });
  expect(result.draft).toBeNull();
});

test("confirmed erasure recreates the database after an unrecoverable open failure", async ({
  page,
}) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-recreate-${crypto.randomUUID()}`;
      const future = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 2);
        request.onupgradeneeded = () => request.result.createObjectStore("sentinel");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = future.transaction("sentinel", "readwrite");
        transaction.objectStore("sentinel").put("must be erased", "record");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      future.close();
      localStorage.setItem("mecha-todo:composer-draft:v1", "must be cleared");

      const repository = new IndexedDbAppRepository({ databaseName: name, clock: () => 500 });
      const startup = await repository.initialize();
      const erased = await repository.eraseLocalData({ confirmed: true });
      const inspection = await databaseModule.openVersionedDatabase({ name });
      if (!inspection.ok) return inspection;
      const stores = Array.from(inspection.database.objectStoreNames).sort();
      const metadata = await inspection.database.getAll("meta");
      inspection.database.close();
      const draft = localStorage.getItem("mecha-todo:composer-draft:v1");
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return { startup, erased, stores, metadata, draft };
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.startup).toMatchObject({
    ok: false,
    category: "local-data",
    technicalCategory: "open-failed",
  });
  expect(result.erased).toMatchObject({
    ok: true,
    projection: { activeTodos: [], lifetimeXp: 0, progression: { level: 0 }, rank: "Cadet" },
  });
  expect(result.stores).toEqual(["completionAwards", "meta", "todos"]);
  expect(result.metadata).toEqual([
    {
      key: "core",
      createdAt: 500,
      rulesVersion: 1,
      nextCreationOrder: 0,
      nextCompletionOrder: 0,
    },
    { key: "derived-stats", lifetimeXp: 0, awardCount: 0 },
  ]);
  expect(result.draft).toBeNull();
});
