import { expect, test, type Locator, type Page } from "@playwright/test";

test("edits Active, Standby, and Completed todos through every save path", async ({ page }) => {
  await page.goto("/");
  await addTasks(page, 9);

  const activeOne = await stableRowWithText(page, ".active-bay", "Task 1");
  await activeOne.locator(".todo-text").click();
  const activeEditor = activeOne.getByRole("textbox", { name: "Edit Task 1" });
  await expect(activeEditor).toHaveAttribute("enterkeyhint", "done");
  await activeEditor.fill("  Active   edited  ");
  await activeEditor.press("Enter");
  await expect(activeOne.locator(".todo-text")).toHaveText("Active edited");

  await page.getByRole("button", { name: /Standby 1/ }).click();
  const standby = await stableRowWithText(page, "#standby-tasks", "Task 9");
  await standby.locator(".todo-text").click();
  const standbyEditor = standby.getByRole("textbox", { name: "Edit Task 9" });
  await standbyEditor.fill("Standby   edited");
  await standbyEditor.press("Tab");
  await expect(standby.locator(".todo-text")).toHaveText("Standby edited");

  await page.getByRole("checkbox", { name: "Complete Task 2" }).click();
  await expect(page.getByRole("button", { name: /Completed 1/ })).toBeVisible();
  await page.getByRole("button", { name: /Completed 1/ }).click();

  const completed = await stableRowWithText(page, "#completed-tasks", "Task 2");
  await completed.locator(".todo-text").click();
  const completedEditor = completed.getByRole("textbox", { name: "Edit Task 2" });
  await completedEditor.fill("Discarded edit");
  await completedEditor.press("Escape");
  await expect(completed.locator(".todo-text")).toHaveText("Task 2");
  await expect(completed.locator(".todo-text")).toBeFocused();

  const xpBeforeCompletedEdit = await page.locator(".hud-level span").textContent();
  const activeOrderBeforeCompletedEdit = await page
    .locator(".active-bay .todo-text")
    .allTextContents();
  await completed.locator(".todo-text").click();
  const invalidEditor = completed.getByRole("textbox", { name: "Edit Task 2" });
  await invalidEditor.fill(" \n\t ");
  const invalidDraft = await invalidEditor.inputValue();
  await invalidEditor.press("Enter");
  await expect(completed.getByText("Enter a task.")).toBeVisible();
  await expect(invalidEditor).toHaveValue(invalidDraft);
  await expect(invalidEditor).toBeFocused();
  await invalidEditor.fill("Completed edited");
  await invalidEditor.press("Enter");
  await expect(completed.locator(".todo-text")).toHaveText("Completed edited");
  await expect(page.locator(".hud-level span")).toHaveText(xpBeforeCompletedEdit ?? "");
  expect(await page.locator(".active-bay .todo-text").allTextContents()).toEqual(
    activeOrderBeforeCompletedEdit,
  );

  const missing = await stableRowWithText(page, ".active-bay", "Task 3");
  const missingId = await missing.getAttribute("data-todo-id");
  expect(missingId).not.toBeNull();
  await missing.locator(".todo-text").click();
  const missingEditor = missing.getByRole("textbox", { name: "Edit Task 3" });
  await missingEditor.fill("Draft survives missing record");
  await removeTodoDirectly(page, missingId!);
  await missingEditor.press("Enter");
  await expect(missing.getByText("List changed in another tab. Reload to continue.")).toBeVisible();
  await expect(missingEditor).toHaveValue("Draft survives missing record");
  await expect(missingEditor).toBeFocused();
});

test("completes both open statuses, reopens over capacity, and re-completes without XP", async ({
  page,
}) => {
  await page.goto("/");
  await addTasks(page, 9);

  await page.getByRole("button", { name: /Standby 1/ }).click();
  const standbyRow = await stableRowWithText(page, "#standby-tasks", "Task 9");
  const standbyToggle = standbyRow.locator(".todo-status");
  await standbyToggle.click();
  await expect(standbyToggle).toHaveAttribute("aria-checked", "true");
  await expect(standbyToggle).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Complete Task 1" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Completed 1/ })).toBeVisible();

  const activeRow = await stableRowWithText(page, ".active-bay", "Task 1");
  const activeToggle = activeRow.locator(".todo-status");
  await activeToggle.click();
  await expect(activeToggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /Completed 2/ })).toBeVisible();

  const composer = page.getByRole("textbox", { name: "New task" });
  await composer.fill("Capacity filler");
  await composer.press("Enter");
  await expect(page.locator(".active-bay .todo-row")).toHaveCount(8);

  await page.getByRole("button", { name: /Completed 2/ }).click();
  await page.getByRole("checkbox", { name: "Reopen Task 1" }).click();
  await expect(page.getByRole("status")).toContainText("TASK REOPENED · XP RETAINED");
  await expect(page.locator(".active-bay .todo-row")).toHaveCount(9);

  const xpBeforeRecompletion = await page.locator(".hud-level span").textContent();
  await page.getByRole("checkbox", { name: "Complete Task 1" }).click();
  await expect(page.getByRole("status")).toContainText("TASK COMPLETE · ALREADY CREDITED");
  await expect(page.locator(".hud-level span")).toHaveText(xpBeforeRecompletion ?? "");
  await expect(page.locator("#completed-tasks .todo-text").first()).toHaveText("Task 1");

  await page.reload();
  await page.getByRole("button", { name: /Completed 2/ }).click();
  await expect(page.locator("#completed-tasks .todo-text").first()).toHaveText("Task 1");
});

test("rolls back a rejected optimistic completion and restores focus", async ({ page }) => {
  await mountDelayedRepository(page, "completion-failure");

  const firstRow = await stableRowWithText(page, ".active-bay", "First task");
  const first = firstRow.locator(".todo-status");
  await first.click();
  await expect(first).toHaveAttribute("aria-checked", "true");
  await expect(first).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Complete Second task" })).toBeEnabled();

  await page.evaluate(() => {
    (window as typeof window & { resolveMutation: () => void }).resolveMutation();
  });
  await expect(first).toHaveAttribute("aria-checked", "false");
  await expect(first).toBeEnabled();
  await expect(first).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    "List changed in another tab. Reload to continue.",
  );
});

test("keeps a reopened todo in one section while Completed refresh is delayed", async ({
  page,
}) => {
  await mountReopenRefreshRepository(page);
  await page.getByRole("button", { name: /Completed 1/ }).click();

  const rows = page.locator('.todo-row[data-todo-id="reopened"]');
  await expect(rows).toHaveCount(1);
  await expect(rows).toBeVisible();

  await page.getByRole("checkbox", { name: "Reopen Reopen target" }).click();
  const activeToggle = page.getByRole("checkbox", { name: "Complete Reopen target" });
  await expect(activeToggle).toBeVisible();
  await expect(activeToggle).toBeDisabled();
  await expect(rows).toHaveCount(1);
  await expect(page.locator('#completed-tasks .todo-row[data-todo-id="reopened"]')).toHaveCount(0);
  await expect(page.getByRole("status")).not.toContainText("TASK REOPENED");

  await page.evaluate(() => {
    (window as typeof window & { resolvePageRefresh: () => void }).resolvePageRefresh();
  });

  await expect(activeToggle).toBeEnabled();
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("TASK REOPENED · XP RETAINED");
});

test("reports a committed mutation when a paged-list refresh fails", async ({ page }) => {
  await mountReopenRefreshRepository(page, true);
  await page.getByRole("button", { name: /Completed 1/ }).click();
  await page.getByRole("checkbox", { name: "Reopen Reopen target" }).click();

  await expect(page.getByRole("status")).toContainText("Task saved. Reload the lists.");
  await expect(page.locator('.todo-row[data-todo-id="reopened"]')).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "Complete Reopen target" })).toBeEnabled();
});

test("deletes every status, promotes Standby, restores one row, and retains XP", async ({
  page,
}) => {
  await page.goto("/");
  await addTasks(page, 9);

  await page.getByRole("button", { name: "Delete Task 1" }).click();
  await expect(page.getByRole("status")).toContainText("TASK DELETED");
  await expect(page.locator(".active-bay .todo-row")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Task 9", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toContainText("TASK RESTORED");
  await expect(page.locator(".active-bay .todo-row")).toHaveCount(9);

  const composer = page.getByRole("textbox", { name: "New task" });
  await composer.fill("Standby delete target");
  await composer.press("Enter");
  await page.getByRole("button", { name: /Standby 1/ }).click();
  await page.getByRole("button", { name: "Delete Standby delete target" }).click();
  await expect(page.getByRole("status")).toContainText("TASK DELETED");
  await expect(page.getByRole("button", { name: /Standby 0/ })).toBeVisible();

  await page.getByRole("checkbox", { name: "Complete Task 2" }).click();
  await expect(page.getByRole("button", { name: /Completed 1/ })).toBeVisible();
  await page.getByRole("button", { name: /Completed 1/ }).click();
  const xpBeforeDelete = await page.locator(".hud-level span").textContent();
  await page.getByRole("button", { name: "Delete Task 2" }).click();
  await expect(page.getByRole("status")).toContainText("TASK DELETED · XP RETAINED");
  await expect(page.locator(".hud-level span")).toHaveText(xpBeforeDelete ?? "");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /Completed 1/ })).toBeVisible();

  await page.getByRole("button", { name: "Delete Task 3" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Task 3" })).toHaveCount(0);
  await expect(page.locator(".hud-level span")).toHaveText(xpBeforeDelete ?? "");
});

test("keeps a row until delete commits, then offers one Undo", async ({ page }) => {
  await mountDelayedRepository(page, "delete-success");

  const row = await stableRowWithText(page, ".active-bay", "First task");
  const deleteButton = page.getByRole("button", { name: "Delete First task" });
  await deleteButton.click();
  await expect(row).toBeVisible();
  await expect(deleteButton).toBeDisabled();

  await page.evaluate(() => {
    (window as typeof window & { resolveMutation: () => void }).resolveMutation();
  });
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("TASK DELETED");
});

test("dismisses expired and rejected Undo offers", async ({ page }) => {
  await page.goto("/");
  await addTasks(page, 2);

  await page.getByRole("button", { name: "Delete Task 1" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0, { timeout: 6_000 });

  const secondRow = rowWithText(page, ".active-bay", "Task 2");
  const secondId = await secondRow.getAttribute("data-todo-id");
  const snapshot = await readTodoDirectly(page, secondId!);
  await page.getByRole("button", { name: "Delete Task 2" }).click();
  await addTodoDirectly(page, snapshot);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toContainText(
    "List changed in another tab. Reload to continue.",
  );
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

async function addTasks(page: Page, count: number): Promise<void> {
  const composer = page.getByRole("textbox", { name: "New task" });
  for (let index = 1; index <= count; index += 1) {
    await composer.fill(`Task ${index}`);
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
  }
}

function rowWithText(page: Page, section: string, text: string) {
  return page.locator(`${section} .todo-row`).filter({ has: page.locator(".todo-text", { hasText: text }) });
}

async function stableRowWithText(page: Page, section: string, text: string): Promise<Locator> {
  const match = rowWithText(page, section, text);
  const id = await match.getAttribute("data-todo-id");
  if (!id) throw new Error(`Todo row not found: ${text}`);
  return page.locator(`.todo-row[data-todo-id="${id}"]`);
}

async function removeTodoDirectly(page: Page, id: string): Promise<void> {
  await page.evaluate(async (todoId) => {
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open("mecha-todo");
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const database = opening.result;
        const transaction = database.transaction("todos", "readwrite");
        transaction.objectStore("todos").delete(todoId);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, id);
}

async function readTodoDirectly(page: Page, id: string) {
  return page.evaluate(async (todoId) => {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const opening = indexedDB.open("mecha-todo");
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const database = opening.result;
        const transaction = database.transaction("todos", "readonly");
        const request = transaction.objectStore("todos").get(todoId);
        request.onsuccess = () => resolve(request.result as Record<string, unknown>);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
      };
    });
  }, id);
}

async function addTodoDirectly(page: Page, todo: Record<string, unknown>): Promise<void> {
  await page.evaluate(async (record) => {
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open("mecha-todo");
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const database = opening.result;
        const transaction = database.transaction("todos", "readwrite");
        transaction.objectStore("todos").add(record);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, todo);
}

async function mountDelayedRepository(
  page: Page,
  scenario: "completion-failure" | "delete-success",
): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (requestedScenario) => {
    const fixturePath = "http://127.0.0.1:4174/mount-app.js";
    const { mountApp } = await import(fixturePath);
    const todo = (id: string, text: string) => ({
      id,
      text,
      status: "active" as const,
      creationOrder: id === "first" ? 0 : 1,
      completionOrder: null,
      createdAt: 0,
      updatedAt: 0,
      completedAt: null,
    });
    const first = todo("first", "First task");
    const second = todo("second", "Second task");
    const applicationViewState = (activeTodos: Array<typeof first>) => ({
      activeTodos,
      standbyCount: 0,
      completedCount: 0,
      progression: {
        level: 0,
        lifetimeXp: 0,
        currentLevelXp: 0,
        nextLevelXp: 10,
        xpForCurrentLevel: 0,
        xpForNextLevel: 10,
        progress: 0,
      },
      rank: "Cadet",
      activeCapacity: 8,
      rewardHud: { link: null, combo: null },
    });
    let current = applicationViewState([first, second]);
    let resolveMutation: (() => void) | undefined;
    const delayed = new Promise<unknown>((resolve) => {
      resolveMutation = () => {
        if (requestedScenario === "completion-failure") {
          resolve({
            ok: false,
            category: "changed-in-another-tab",
            message: "List changed in another tab. Reload to continue.",
          });
          return;
        }
        current = applicationViewState([second]);
        resolve({
          ok: true,
          deletedTodo: first,
          retainedAward: false,
          promotedTodoIds: [],
          applicationViewState: current,
        });
      };
    });
    (window as typeof window & { resolveMutation: () => void }).resolveMutation = () =>
      resolveMutation?.();

    mountApp({
      initialize: async () => ({ ok: true, applicationViewState: current }),
      getApplicationViewState: async () => current,
      getTodoPage: async () => ({ items: [], hasMore: false, nextCursor: null }),
      addTodo: async () => { throw new Error("Not used"); },
      editTodo: async () => { throw new Error("Not used"); },
      setTodoCompleted: async () => delayed as never,
      deleteTodo: async () => delayed as never,
      restoreDeletedTodo: async () => { throw new Error("Not used"); },
      eraseLocalData: async () => { throw new Error("Not used"); },
      close: () => undefined,
    });
  }, scenario);
}

async function mountReopenRefreshRepository(page: Page, failRefresh = false): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (shouldFailRefresh) => {
    const fixturePath = "http://127.0.0.1:4174/mount-app.js";
    const { mountApp } = await import(fixturePath);
    const completed = {
      id: "reopened",
      text: "Reopen target",
      status: "completed" as const,
      creationOrder: 0,
      completionOrder: 0,
      createdAt: 0,
      updatedAt: 10,
      completedAt: 10,
    };
    const reopened = {
      ...completed,
      status: "active" as const,
      completionOrder: null,
      updatedAt: 20,
      completedAt: null,
    };
    const progression = {
      level: 1,
      lifetimeXp: 10,
      currentLevelXp: 10,
      nextLevelXp: 30,
      xpForCurrentLevel: 0,
      xpForNextLevel: 20,
      progress: 0,
    };
    const pageOf = (items: Array<typeof completed>) => ({
      items,
      hasMore: false,
      nextCursor: null,
    });
    const applicationViewState = (isReopened: boolean) => ({
      activeTodos: isReopened ? [reopened] : [],
      standbyCount: 0,
      completedCount: isReopened ? 0 : 1,
      progression,
      rank: "Cadet",
      activeCapacity: 8,
      rewardHud: { link: null, combo: null },
    });
    let current = applicationViewState(false);
    let completedPageReads = 0;
    let resolvePageRefresh: (() => void) | undefined;
    const delayedRefresh = new Promise<void>((resolve) => {
      resolvePageRefresh = resolve;
    });
    (window as typeof window & { resolvePageRefresh: () => void }).resolvePageRefresh = () =>
      resolvePageRefresh?.();

    mountApp({
      initialize: async () => ({ ok: true, applicationViewState: current }),
      getApplicationViewState: async () => current,
      getTodoPage: async (status: "standby" | "completed") => {
        if (status !== "completed") return pageOf([]);
        completedPageReads += 1;
        if (completedPageReads === 1) return pageOf([completed]);
        if (!shouldFailRefresh) await delayedRefresh;
        if (shouldFailRefresh) throw new Error("Refresh failed");
        return pageOf([]);
      },
      addTodo: async () => { throw new Error("Not used"); },
      editTodo: async () => { throw new Error("Not used"); },
      setTodoCompleted: async () => {
        current = applicationViewState(true);
        return {
          ok: true,
          action: "reopened",
          changed: true,
          todo: reopened,
          award: null,
          xpGained: 0,
          alreadyCredited: false,
          promotedTodoIds: [],
          applicationViewState: current,
        };
      },
      deleteTodo: async () => { throw new Error("Not used"); },
      restoreDeletedTodo: async () => { throw new Error("Not used"); },
      eraseLocalData: async () => { throw new Error("Not used"); },
      close: () => undefined,
    });
  }, failRefresh);
}
