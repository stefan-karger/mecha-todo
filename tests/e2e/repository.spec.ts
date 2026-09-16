import { expect, test } from "@playwright/test";

const databaseModulePath = "http://127.0.0.1:4174/db.js";
const repositoryModulePath = "http://127.0.0.1:4174/repository.js";

test("validates before writing and persists clock-independent creation order", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async (repositoryPath) => {
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-add-${crypto.randomUUID()}`;
      const timestamps = [1_000, 300, 200, 100, 50, 40, 30, 20, 10, 5, 1];
      let id = 0;
      const repository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => timestamps.shift() ?? 0,
        idFactory: () => `todo-${String(++id).padStart(2, "0")}`,
      });
      const startup = await repository.initialize();
      const invalid = await repository.addTodo(" \n\t ");
      const additions = [];
      for (let index = 0; index < 10; index += 1) {
        additions.push(await repository.addTodo(` Task ${index + 1} `));
      }
      repository.close();

      const reloadedRepository = new IndexedDbAppRepository({ databaseName: name });
      const reloaded = await reloadedRepository.initialize();
      reloadedRepository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const addedTodos = additions.map(
        (addition: {
          ok: boolean;
          todo: {
            id: string;
            text: string;
            status: string;
            creationOrder: number;
            createdAt: number;
          };
        }) => addition.todo,
      );

      return {
        startup,
        invalid,
        addedTodos,
        reloaded,
      };
    },
    repositoryModulePath,
  );

  expect(result.startup).toMatchObject({ ok: true });
  expect(result.invalid).toEqual({
    ok: false,
    category: "validation",
    validation: {
      ok: false,
      reason: "empty",
      message: "Enter a task.",
      value: "",
      codePointLength: 0,
    },
  });
  expect(result.addedTodos).toHaveLength(10);
  expect(result.addedTodos.map((todo) => todo.creationOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(result.addedTodos.map((todo) => todo.createdAt)).toEqual([300, 200, 100, 50, 40, 30, 20, 10, 5, 1]);
  expect(result.addedTodos.map((todo) => todo.text)).toEqual(
    Array.from({ length: 10 }, (_, index) => `Task ${index + 1}`),
  );
  expect(result.addedTodos.slice(0, 8).every((todo) => todo.status === "active")).toBe(true);
  expect(result.addedTodos.slice(8).every((todo) => todo.status === "standby")).toBe(true);
  expect(result.reloaded).toMatchObject({
    ok: true,
    projection: {
      activeTodos: result.addedTodos.slice(0, 8),
      standbyTodos: { items: result.addedTodos.slice(8), hasMore: false },
    },
  });
});

test("derives placement capacity from authoritative Lifetime XP", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-capacity-${crypto.randomUUID()}`;
      const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 0 });
      if (!opened.ok) {
        return opened;
      }

      const transaction = opened.database.transaction("completionAwards", "readwrite");
      for (let index = 0; index < 8; index += 1) {
        await transaction.store.add({
          todoId: `awarded-${index}`,
          awardedAt: index,
          dayKey: `${2000 + index}-01-01`,
          dailyOrdinal: 1,
          baseXp: 10,
          linkBonus: 0,
          comboBonus: 0,
          totalXp: 10,
          rulesVersion: 1,
        });
      }
      await transaction.done;
      opened.database.close();

      let id = 0;
      const repository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => 100,
        idFactory: () => `todo-${++id}`,
      });
      const startup = await repository.initialize();
      const additions = [];
      for (let index = 0; index < 10; index += 1) {
        additions.push(await repository.addTodo(`Task ${index + 1}`));
      }
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        startup,
        statuses: additions.map(
          (addition: { todo: { status: string } }) => addition.todo.status,
        ),
      };
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.startup).toMatchObject({
    ok: true,
    projection: { lifetimeXp: 80, activeCapacity: 9, progression: { level: 5 } },
  });
  expect(result.statuses).toEqual([
    "active",
    "active",
    "active",
    "active",
    "active",
    "active",
    "active",
    "active",
    "active",
    "standby",
  ]);
});

test("pages Standby oldest first and Completed newest first", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-pages-${crypto.randomUUID()}`;
      const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 0 });
      if (!opened.ok) {
        return opened;
      }

      const transaction = opened.database.transaction(
        ["todos", "completionAwards", "meta"],
        "readwrite",
      );
      for (let index = 0; index < 3; index += 1) {
        await transaction.objectStore("todos").add({
          id: `active-${index}`,
          text: `Active ${index}`,
          status: "active",
          creationOrder: index,
          completionOrder: null,
          createdAt: 100 - index,
          updatedAt: 100 - index,
          completedAt: null,
        });
      }
      for (let index = 0; index < 45; index += 1) {
        await transaction.objectStore("todos").add({
          id: `standby-${String(index).padStart(2, "0")}`,
          text: `Standby ${index}`,
          status: "standby",
          creationOrder: index + 3,
          completionOrder: null,
          createdAt: 1_000 - index,
          updatedAt: 1_000 - index,
          completedAt: null,
        });
      }
      for (let index = 0; index < 45; index += 1) {
        const id = `completed-${String(index).padStart(2, "0")}`;
        await transaction.objectStore("todos").add({
          id,
          text: `Completed ${index}`,
          status: "completed",
          creationOrder: index + 48,
          completionOrder: index,
          createdAt: index,
          updatedAt: index + 100,
          completedAt: index + 100,
        });
        await transaction.objectStore("completionAwards").add({
          todoId: id,
          awardedAt: index + 100,
          dayKey: `${1900 + index}-01-01`,
          dailyOrdinal: 1,
          baseXp: 10,
          linkBonus: 0,
          comboBonus: 0,
          totalXp: 10,
          rulesVersion: 1,
        });
      }
      await transaction.done;
      opened.database.close();

      const repository = new IndexedDbAppRepository({ databaseName: name });
      const startup = await repository.initialize();
      if (!startup.ok) {
        return startup;
      }
      const first = startup.projection;
      const second = await repository.getProjection({
        standbyAfter: first.standbyTodos.nextCursor ?? undefined,
        completedBefore: first.completedTodos.nextCursor ?? undefined,
      });
      const third = await repository.getProjection({
        standbyAfter: second.standbyTodos.nextCursor ?? undefined,
        completedBefore: second.completedTodos.nextCursor ?? undefined,
      });
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const summarize = (projection: typeof first) => ({
        active: projection.activeTodos.map((todo: { id: string }) => todo.id),
        standby: projection.standbyTodos.items.map((todo: { id: string }) => todo.id),
        standbyHasMore: projection.standbyTodos.hasMore,
        completed: projection.completedTodos.items.map((todo: { id: string }) => todo.id),
        completedHasMore: projection.completedTodos.hasMore,
      });
      return { first: summarize(first), second: summarize(second), third: summarize(third) };
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.first.active).toEqual(["active-0", "active-1", "active-2"]);
  expect(result.first.standby).toEqual(
    Array.from({ length: 20 }, (_, index) => `standby-${String(index).padStart(2, "0")}`),
  );
  expect(result.second.standby).toEqual(
    Array.from({ length: 20 }, (_, index) => `standby-${String(index + 20).padStart(2, "0")}`),
  );
  expect(result.third.standby).toEqual(
    Array.from({ length: 5 }, (_, index) => `standby-${String(index + 40).padStart(2, "0")}`),
  );
  expect(result.first.completed).toEqual(
    Array.from({ length: 20 }, (_, index) => `completed-${String(44 - index).padStart(2, "0")}`),
  );
  expect(result.second.completed).toEqual(
    Array.from({ length: 20 }, (_, index) => `completed-${String(24 - index).padStart(2, "0")}`),
  );
  expect(result.third.completed).toEqual(
    Array.from({ length: 5 }, (_, index) => `completed-${String(4 - index).padStart(2, "0")}`),
  );
  expect(result.first.standbyHasMore).toBe(true);
  expect(result.second.standbyHasMore).toBe(true);
  expect(result.third.standbyHasMore).toBe(false);
  expect(result.first.completedHasMore).toBe(true);
  expect(result.second.completedHasMore).toBe(true);
  expect(result.third.completedHasMore).toBe(false);
});

test("uses last successful write wins and reports a missing target", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-edit-${crypto.randomUUID()}`;
      const firstRepository = new IndexedDbAppRepository({
        databaseName: name,
        clock: (() => {
          let time = 0;
          return () => ++time;
        })(),
        idFactory: () => "todo-1",
      });
      const secondRepository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => 100,
      });
      await firstRepository.initialize();
      const added = await firstRepository.addTodo("Initial text");
      await secondRepository.initialize();
      if (!added.ok) {
        return added;
      }

      const [firstEdit, lastEdit] = await Promise.all([
        firstRepository.editTodo(added.todo.id, " First edit "),
        secondRepository.editTodo(added.todo.id, "Last edit"),
      ]);
      const afterEdits = await firstRepository.getProjection();

      const directConnection = await databaseModule.openVersionedDatabase({ name });
      if (!directConnection.ok) {
        return directConnection;
      }
      await directConnection.database.delete("todos", added.todo.id);
      directConnection.database.close();

      const missing = await firstRepository.editTodo(added.todo.id, "Must not return");
      const afterMissing = await firstRepository.getProjection();
      firstRepository.close();
      secondRepository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return { added, firstEdit, lastEdit, afterEdits, missing, afterMissing };
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.firstEdit).toMatchObject({
    ok: true,
    todo: {
      text: "First edit",
      status: result.added.todo.status,
      creationOrder: result.added.todo.creationOrder,
      completionOrder: null,
      createdAt: result.added.todo.createdAt,
      completedAt: null,
    },
  });
  expect(result.lastEdit).toMatchObject({ ok: true, todo: { text: "Last edit", updatedAt: 100 } });
  expect(result.afterEdits.activeTodos[0]?.text).toBe("Last edit");
  expect(result.missing).toEqual({
    ok: false,
    category: "changed-in-another-tab",
    message: "List changed in another tab. Reload to continue.",
  });
  expect(result.afterMissing.activeTodos).toEqual([]);
});
