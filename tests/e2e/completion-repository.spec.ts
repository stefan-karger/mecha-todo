import { expect, test } from "@playwright/test";

const databaseModulePath = "http://127.0.0.1:4174/db.js";
const repositoryModulePath = "http://127.0.0.1:4174/repository.js";

test("awards every milestone once and re-completes with the latest order", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async (repositoryPath) => {
    const { IndexedDbAppRepository } = await import(repositoryPath);
    const name = `mecha-todo-milestones-${crypto.randomUUID()}`;
    let timestamp = 100;
    let id = 0;
    const repository = new IndexedDbAppRepository({
      databaseName: name,
      clock: () => timestamp++,
      calendar: () => ({ year: 2026, month: 9, day: 14 }),
      idFactory: () => `todo-${++id}`,
    });
    await repository.initialize();

    const todoIds: string[] = [];
    for (let index = 0; index < 21; index += 1) {
      const added = await repository.addTodo(`Task ${index + 1}`);
      if (!added.ok) {
        return added;
      }
      todoIds.push(added.todo.id);
    }

    const completions = [];
    for (const todoId of todoIds) {
      completions.push(await repository.setTodoCompleted(todoId, true));
    }
    const reopened = await repository.setTodoCompleted(todoIds[0], false);
    const recompleted = await repository.setTodoCompleted(todoIds[0], true);
    const applicationViewState = await repository.getApplicationViewState();
    const completedPage = await repository.getTodoPage("completed");
    repository.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return {
      completions: completions.map(
        (completion: {
          award: { dailyOrdinal: number; comboBonus: number; linkBonus: number } | null;
          xpGained: number;
          alreadyCredited: boolean;
        }) => ({
          ordinal: completion.award?.dailyOrdinal,
          combo: completion.award?.comboBonus,
          link: completion.award?.linkBonus,
          xpGained: completion.xpGained,
          alreadyCredited: completion.alreadyCredited,
        }),
      ),
      reopened,
      recompleted,
      applicationViewState,
      completedPage,
    };
  }, repositoryModulePath);

  const expectedCombos = new Map([
    [5, 2],
    [10, 4],
    [15, 6],
    [20, 8],
  ]);
  expect(result.completions).toHaveLength(21);
  for (const [index, completion] of result.completions.entries()) {
    const ordinal = index + 1;
    const combo = expectedCombos.get(ordinal) ?? 0;
    expect(completion).toEqual({
      ordinal,
      combo,
      link: 0,
      xpGained: 10 + combo,
      alreadyCredited: false,
    });
  }
  expect(result.reopened).toMatchObject({
    ok: true,
    action: "reopened",
    changed: true,
    xpGained: 0,
    todo: { id: "todo-1", status: "active", creationOrder: 0, completionOrder: null },
  });
  expect(result.recompleted).toMatchObject({
    ok: true,
    action: "completed",
    changed: true,
    award: null,
    xpGained: 0,
    alreadyCredited: true,
    todo: { id: "todo-1", status: "completed", creationOrder: 0, completionOrder: 21 },
  });
  expect(result.recompleted.applicationViewState).not.toHaveProperty("completedTodos");
  expect(result.recompleted.applicationViewState).not.toHaveProperty("lifetimeXp");
  expect(result.applicationViewState.progression.lifetimeXp).toBe(230);
  expect(result.completedPage.items[0]).toMatchObject({
    id: "todo-1",
    completionOrder: 21,
  });
});

test("retains deleted award history for the next local day's LINK", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-anonymous-award-${crypto.randomUUID()}`;
      let localDay = 14;
      let id = 0;
      const repository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => 100 + localDay,
        calendar: () => ({ year: 2026, month: 9, day: localDay }),
        idFactory: () => `todo-${++id}`,
      });
      await repository.initialize();
      const firstTodo = await repository.addTodo("First day");
      if (!firstTodo.ok) {
        return firstTodo;
      }
      const firstCompletion = await repository.setTodoCompleted(firstTodo.todo.id, true);

      const direct = await databaseModule.openVersionedDatabase({ name });
      if (!direct.ok) {
        return direct;
      }
      await direct.database.delete("todos", firstTodo.todo.id);
      direct.database.close();

      localDay = 15;
      const secondTodo = await repository.addTodo("Next day");
      if (!secondTodo.ok) {
        return secondTodo;
      }
      const linkedCompletion = await repository.setTodoCompleted(secondTodo.todo.id, true);
      const applicationViewState = await repository.getApplicationViewState();

      const inspection = await databaseModule.openVersionedDatabase({ name });
      if (!inspection.ok) {
        return inspection;
      }
      const awards = await inspection.database.getAll("completionAwards");
      inspection.database.close();
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return { firstCompletion, linkedCompletion, applicationViewState, awards };
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.firstCompletion).toMatchObject({
    ok: true,
    award: { dayKey: "2026-09-14", dailyOrdinal: 1, totalXp: 10 },
  });
  expect(result.linkedCompletion).toMatchObject({
    ok: true,
    award: { dayKey: "2026-09-15", dailyOrdinal: 1, linkBonus: 5, totalXp: 15 },
    xpGained: 15,
  });
  expect(result.applicationViewState.progression.lifetimeXp).toBe(25);
  expect(result.awards).toHaveLength(2);
  expect(result.awards.some((award: Record<string, unknown>) => "text" in award)).toBe(false);
});

test("reopen may leave Active Bay above capacity", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async (repositoryPath) => {
    const { IndexedDbAppRepository } = await import(repositoryPath);
    const name = `mecha-todo-over-capacity-${crypto.randomUUID()}`;
    let id = 0;
    const repository = new IndexedDbAppRepository({
      databaseName: name,
      clock: () => 100,
      calendar: () => ({ year: 2026, month: 9, day: 14 }),
      idFactory: () => `todo-${++id}`,
    });
    await repository.initialize();
    const todoIds = [];
    for (let index = 0; index < 9; index += 1) {
      const added = await repository.addTodo(`Task ${index + 1}`);
      if (!added.ok) {
        return added;
      }
      todoIds.push(added.todo.id);
    }

    const completed = await repository.setTodoCompleted(todoIds[0], true);
    const reopened = await repository.setTodoCompleted(todoIds[0], false);
    repository.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return { completed, reopened };
  }, repositoryModulePath);

  expect(result.completed).toMatchObject({
    ok: true,
    promotedTodoIds: ["todo-9"],
    applicationViewState: { activeTodos: expect.any(Array), activeCapacity: 8 },
  });
  expect(result.completed.applicationViewState.activeTodos).toHaveLength(8);
  expect(result.reopened).toMatchObject({
    ok: true,
    action: "reopened",
    applicationViewState: { activeCapacity: 8 },
  });
  expect(result.reopened.applicationViewState.activeTodos).toHaveLength(9);
  expect(result.reopened.applicationViewState.progression.lifetimeXp).toBe(10);
});

test("fills every available slot from the oldest Standby todos", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);
      const name = `mecha-todo-multi-promotion-${crypto.randomUUID()}`;
      const opened = await databaseModule.openVersionedDatabase({ name, createdAt: 0 });
      if (!opened.ok) {
        return opened;
      }

      const transaction = opened.database.transaction(["todos", "meta"], "readwrite");
      for (let index = 0; index < 3; index += 1) {
        await transaction.objectStore("todos").add({
          id: `active-${index}`,
          text: `Active ${index}`,
          status: "active",
          creationOrder: index,
          completionOrder: null,
          createdAt: 0,
          updatedAt: 0,
          completedAt: null,
        });
      }
      for (let index = 0; index < 6; index += 1) {
        await transaction.objectStore("todos").add({
          id: `standby-${index}`,
          text: `Standby ${index}`,
          status: "standby",
          creationOrder: index + 3,
          completionOrder: null,
          createdAt: 0,
          updatedAt: 0,
          completedAt: null,
        });
      }
      await transaction.objectStore("meta").put({
        key: "core",
        createdAt: 0,
        rulesVersion: 1,
        nextCreationOrder: 9,
        nextCompletionOrder: 0,
      });
      await transaction.done;
      opened.database.close();

      const repository = new IndexedDbAppRepository({
        databaseName: name,
        clock: () => 100,
        calendar: () => ({ year: 2026, month: 9, day: 14 }),
      });
      await repository.initialize();
      const completed = await repository.setTodoCompleted("standby-5", true);
      repository.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return completed;
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result).toMatchObject({
    ok: true,
    todo: { id: "standby-5", status: "completed" },
    promotedTodoIds: ["standby-0", "standby-1", "standby-2", "standby-3", "standby-4"],
    applicationViewState: { activeCapacity: 8, standbyCount: 0 },
  });
  expect(result.applicationViewState.activeTodos.map((todo: { id: string }) => todo.id)).toEqual([
    "active-0",
    "active-1",
    "active-2",
    "standby-0",
    "standby-1",
    "standby-2",
    "standby-3",
    "standby-4",
  ]);
  expect(
    result.applicationViewState.activeTodos
      .filter((todo: { id: string }) => todo.id.startsWith("standby-"))
      .map((todo: { updatedAt: number }) => todo.updatedAt),
  ).toEqual([100, 100, 100, 100, 100]);
});

test("does not promote Standby when Active Bay is already at capacity", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async (repositoryPath) => {
    const { IndexedDbAppRepository } = await import(repositoryPath);
    const name = `mecha-todo-no-promotion-${crypto.randomUUID()}`;
    let id = 0;
    const repository = new IndexedDbAppRepository({
      databaseName: name,
      clock: () => 100,
      calendar: () => ({ year: 2026, month: 9, day: 14 }),
      idFactory: () => `todo-${++id}`,
    });
    await repository.initialize();
    for (let index = 0; index < 10; index += 1) {
      const added = await repository.addTodo(`Task ${index + 1}`);
      if (!added.ok) return added;
    }

    const completed = await repository.setTodoCompleted("todo-9", true);
    repository.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return completed;
  }, repositoryModulePath);

  expect(result).toMatchObject({
    ok: true,
    todo: { id: "todo-9", status: "completed" },
    promotedTodoIds: [],
    applicationViewState: {
      activeTodos: expect.any(Array),
      standbyCount: 1,
    },
  });
  expect(result.applicationViewState.activeTodos).toHaveLength(8);
});

test("same-todo and different-todo races preserve award uniqueness", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(
    async ({ databasePath, repositoryPath }) => {
      const databaseModule = await import(databasePath);
      const { IndexedDbAppRepository } = await import(repositoryPath);

      const sameName = `mecha-todo-same-race-${crypto.randomUUID()}`;
      const sameFirst = new IndexedDbAppRepository({
        databaseName: sameName,
        clock: () => 100,
        calendar: () => ({ year: 2026, month: 9, day: 14 }),
        idFactory: () => "same-todo",
      });
      const sameSecond = new IndexedDbAppRepository({
        databaseName: sameName,
        clock: () => 101,
        calendar: () => ({ year: 2026, month: 9, day: 14 }),
      });
      await sameFirst.initialize();
      const sameAdded = await sameFirst.addTodo("Same race");
      await sameSecond.initialize();
      if (!sameAdded.ok) {
        return sameAdded;
      }
      const sameResults = await Promise.all([
        sameFirst.setTodoCompleted(sameAdded.todo.id, true),
        sameSecond.setTodoCompleted(sameAdded.todo.id, true),
      ]);
      const sameInspection = await databaseModule.openVersionedDatabase({ name: sameName });
      if (!sameInspection.ok) {
        return sameInspection;
      }
      const sameAwards = await sameInspection.database.getAll("completionAwards");
      const sameTodo = await sameInspection.database.get("todos", sameAdded.todo.id);
      sameInspection.database.close();
      sameFirst.close();
      sameSecond.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(sameName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const differentName = `mecha-todo-different-race-${crypto.randomUUID()}`;
      let id = 0;
      const differentFirst = new IndexedDbAppRepository({
        databaseName: differentName,
        clock: () => 200,
        calendar: () => ({ year: 2026, month: 9, day: 14 }),
        idFactory: () => `different-${++id}`,
      });
      const differentSecond = new IndexedDbAppRepository({
        databaseName: differentName,
        clock: () => 201,
        calendar: () => ({ year: 2026, month: 9, day: 14 }),
      });
      await differentFirst.initialize();
      const firstAdded = await differentFirst.addTodo("First contender");
      const secondAdded = await differentFirst.addTodo("Second contender");
      await differentSecond.initialize();
      if (!firstAdded.ok || !secondAdded.ok) {
        return { firstAdded, secondAdded };
      }
      const differentResults = await Promise.all([
        differentFirst.setTodoCompleted(firstAdded.todo.id, true),
        differentSecond.setTodoCompleted(secondAdded.todo.id, true),
      ]);

      const direct = await databaseModule.openVersionedDatabase({ name: differentName });
      if (!direct.ok) {
        return direct;
      }
      await direct.database.delete("todos", firstAdded.todo.id);
      direct.database.close();
      const missing = await differentFirst.setTodoCompleted(firstAdded.todo.id, true);
      const differentInspection = await databaseModule.openVersionedDatabase({ name: differentName });
      if (!differentInspection.ok) {
        return differentInspection;
      }
      const differentAwards = await differentInspection.database.getAll("completionAwards");
      differentInspection.database.close();
      differentFirst.close();
      differentSecond.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(differentName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        same: {
          results: sameResults.map(
            (completion: { xpGained: number; alreadyCredited: boolean; changed: boolean }) => ({
              xpGained: completion.xpGained,
              alreadyCredited: completion.alreadyCredited,
              changed: completion.changed,
            }),
          ),
          awards: sameAwards,
          todo: sameTodo,
        },
        different: {
          results: differentResults.map(
            (completion: { award: { dailyOrdinal: number } | null; xpGained: number }) => ({
              ordinal: completion.award?.dailyOrdinal,
              xpGained: completion.xpGained,
            }),
          ),
          awards: differentAwards,
          missing,
        },
      };
    },
    { databasePath: databaseModulePath, repositoryPath: repositoryModulePath },
  );

  expect(result.same.results).toEqual([
    { xpGained: 10, alreadyCredited: false, changed: true },
    { xpGained: 0, alreadyCredited: true, changed: false },
  ]);
  expect(result.same.awards).toHaveLength(1);
  expect(result.same.todo).toMatchObject({ status: "completed", completionOrder: 0 });
  expect(
    result.different.results
      .map((completion: { ordinal: number }) => completion.ordinal)
      .sort(),
  ).toEqual([1, 2]);
  expect(
    result.different.results.every(
      (completion: { xpGained: number }) => completion.xpGained === 10,
    ),
  ).toBe(true);
  expect(result.different.awards).toHaveLength(2);
  expect(result.different.missing).toEqual({
    ok: false,
    category: "changed-in-another-tab",
    message: "List changed in another tab. Reload to continue.",
  });
});
