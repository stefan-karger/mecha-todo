import { expect, test } from "@playwright/test";

const databaseModulePath = "http://127.0.0.1:4174/db.js";
const repositoryModulePath = "http://127.0.0.1:4174/repository.js";
const undoModulePath = "http://127.0.0.1:4174/delete-undo.js";

test("deletes every status, restores one Active snapshot, and retains XP", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath, undoPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const { DeleteUndoController } = await import(undoPath);
      const name = `mecha-todo-delete-${crypto.randomUUID()}`;
      let id = 0;
      let timestamp = 100;
      const repository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => timestamp++,
        calendar: () => ({ year: 2026, month: 9, day: 14 }),
        idFactory: () => `todo-${++id}`,
      });
      await repository.initialize();

      const todoIds: string[] = [];
      for (let index = 0; index < 9; index += 1) {
        const added = await repository.addTodo(`Task ${index + 1}`);
        if (!added.ok) {
          return added;
        }
        todoIds.push(added.todo.id);
      }

      const undo = new DeleteUndoController();
      const activeDelete = await repository.deleteTodo(todoIds[0]);
      if (!activeDelete.ok) {
        return activeDelete;
      }
      undo.offer(activeDelete.deletedTodo);
      const restored = await undo.undo((snapshot: Parameters<typeof repository.restoreDeletedTodo>[0]) =>
        repository.restoreDeletedTodo(snapshot),
      );

      const standbyAdded = await repository.addTodo("Standby deletion");
      if (!standbyAdded.ok) {
        return standbyAdded;
      }
      const standbyDelete = await repository.deleteTodo(standbyAdded.todo.id);

      const completed = await repository.setTodoCompleted(todoIds[1], true);
      const completedDelete = await repository.deleteTodo(todoIds[1]);
      const beforeReload = await repository.getApplicationViewState();

      const inspection = await databaseModule.openVersionedDatabase({ name });
      if (!inspection.ok) {
        return inspection;
      }
      const awards = await inspection.database.getAll("completionAwards");
      inspection.database.close();
      repository.close();

      const reloadedRepository = new IndexedDbAppRepository({ databaseName: name });
      const reloaded = await reloadedRepository.initialize();
      reloadedRepository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        activeDelete,
        restored,
        undoPendingAfterRestore: undo.hasPendingUndo,
        standbyDelete,
        completed,
        completedDelete,
        beforeReload,
        awards,
        reloaded,
      };
    },
    {
      databasePath: databaseModulePath,
      repositoryPath: repositoryModulePath,
      undoPath: undoModulePath,
    },
  );

  expect(result.activeDelete).toMatchObject({
    ok: true,
    deletedTodo: { id: "todo-1", status: "active", creationOrder: 0 },
    retainedAward: false,
    promotedTodoIds: ["todo-9"],
    applicationViewState: { progression: { lifetimeXp: 0 } },
  });
  expect(
    result.activeDelete.applicationViewState.activeTodos.find(
      (todo: { id: string }) => todo.id === "todo-9",
    ),
  ).toMatchObject({ status: "active", updatedAt: 110 });
  expect(result.restored).toMatchObject({
    ok: true,
    todo: { id: "todo-1", status: "active", creationOrder: 0 },
    applicationViewState: { activeCapacity: 8 },
  });
  expect(result.restored.applicationViewState.activeTodos).toHaveLength(9);
  expect(result.restored.applicationViewState.activeTodos.some((todo: { id: string }) => todo.id === "todo-9")).toBe(
    true,
  );
  expect(result.undoPendingAfterRestore).toBe(false);
  expect(result.standbyDelete).toMatchObject({
    ok: true,
    deletedTodo: { status: "standby" },
    retainedAward: false,
    promotedTodoIds: [],
  });
  expect(result.completed).toMatchObject({ ok: true, xpGained: 10 });
  expect(result.completedDelete).toMatchObject({
    ok: true,
    deletedTodo: { id: "todo-2", status: "completed", completionOrder: 0 },
    retainedAward: true,
    promotedTodoIds: [],
    applicationViewState: { progression: { lifetimeXp: 10 } },
  });
  expect(result.beforeReload.progression.lifetimeXp).toBe(10);
  expect(result.awards).toEqual([
    expect.objectContaining({ todoId: "todo-2", totalXp: 10 }),
  ]);
  expect(result.reloaded).toMatchObject({
    ok: true,
    applicationViewState: { progression: { lifetimeXp: 10 }, activeCapacity: 8 },
  });
  expect(
    result.reloaded.applicationViewState.activeTodos.some((todo: { id: string }) => todo.id === "todo-2"),
  ).toBe(false);
});

test("rejects Undo when another tab recreated the ID and reports missing deletes", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath, undoPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const { DeleteUndoController } = await import(undoPath);
      const name = `mecha-todo-rejected-undo-${crypto.randomUUID()}`;
      const repository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => 100,
        idFactory: () => "todo-1",
      });
      await repository.initialize();
      const added = await repository.addTodo("Recreated elsewhere");
      if (!added.ok) {
        return added;
      }
      const deleted = await repository.deleteTodo(added.todo.id);
      if (!deleted.ok) {
        return deleted;
      }

      const undo = new DeleteUndoController();
      undo.offer(deleted.deletedTodo);
      const otherTab = await databaseModule.openVersionedDatabase({ name });
      if (!otherTab.ok) {
        return otherTab;
      }
      await otherTab.database.add("todos", deleted.deletedTodo);
      otherTab.database.close();

      const rejected = await undo.undo(
        (snapshot: Parameters<typeof repository.restoreDeletedTodo>[0]) =>
          repository.restoreDeletedTodo(snapshot),
      );
      const missingDelete = await repository.deleteTodo("missing-todo");
      const applicationViewState = await repository.getApplicationViewState();
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        rejected,
        undoPending: undo.hasPendingUndo,
        missingDelete,
        applicationViewState,
      };
    },
    {
      databasePath: databaseModulePath,
      repositoryPath: repositoryModulePath,
      undoPath: undoModulePath,
    },
  );

  const changedResult = {
    ok: false,
    category: "changed-in-another-tab",
    message: "List changed in another tab. Reload to continue.",
  };
  expect(result.rejected).toEqual(changedResult);
  expect(result.undoPending).toBe(false);
  expect(result.missingDelete).toEqual(changedResult);
  expect(result.applicationViewState.activeTodos).toHaveLength(1);
  expect(result.applicationViewState.progression.lifetimeXp).toBe(0);
});

test("reload discards the page-owned Undo snapshot", async ({ page }) => {
  await page.goto("/");

  const beforeReload = await page.evaluate(async (undoPath) => {
    const { DeleteUndoController } = await import(undoPath);
    const controller = new DeleteUndoController();
    controller.offer({
      id: "page-owned",
      text: "Only in memory",
      status: "active",
      creationOrder: 0,
      completionOrder: null,
      createdAt: 0,
      updatedAt: 0,
      completedAt: null,
    });
    (globalThis as typeof globalThis & { __ticketUndo?: unknown }).__ticketUndo = controller;
    return {
      pending: controller.hasPendingUndo,
      localStorageKeys: Object.keys(localStorage),
    };
  }, undoModulePath);

  await page.reload();

  const afterReload = await page.evaluate(() => ({
    hasUndoObject: "__ticketUndo" in globalThis,
    localStorageKeys: Object.keys(localStorage),
  }));

  expect(beforeReload).toEqual({ pending: true, localStorageKeys: [] });
  expect(afterReload).toEqual({ hasUndoObject: false, localStorageKeys: [] });
});
