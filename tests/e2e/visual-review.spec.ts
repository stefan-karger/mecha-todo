import { expect, test, type Page, type TestInfo } from "@playwright/test";

test("captures every required release state for visual review", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Active Bay" })).toBeVisible();
  await capture(page, testInfo, "01-empty");

  const composer = page.getByRole("textbox", { name: "New task" });
  for (const task of ["Calibrate left arm", "Review mission notes", "Refill coolant reserve"]) {
    await composer.fill(task);
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
  }
  await capture(page, testInfo, "02-ordinary");

  await page.getByRole("checkbox", { name: "Complete Calibrate left arm" }).click();
  await expect(page.getByRole("status")).toContainText("TASK COMPLETE · +10 XP");
  await capture(page, testInfo, "03-reward");
  await expect(page.getByRole("button", { name: /^Completed 1/ })).toBeVisible();

  for (let index = 4; index <= 10; index += 1) {
    await composer.fill(`Maintenance task ${index}`);
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
  }
  await page.getByRole("button", { name: /^Standby/ }).click();
  await page.getByRole("button", { name: /^Completed/ }).click();
  await expect(page.locator("#standby-tasks .todo-row")).toHaveCount(1);
  await expect(page.locator("#completed-tasks .todo-row")).toHaveCount(1);
  await page.locator(".task-scroll-region").evaluate((region) => {
    region.scrollTop = region.scrollHeight;
  });
  await capture(page, testInfo, "04-expanded");

  await mountLongContent(page);
  await capture(page, testInfo, "05-long-content");

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await capture(page, testInfo, "06-settings");

  await mountLocalDataError(page);
  await expect(page.getByRole("heading", { name: "Local data could not be opened." })).toBeVisible();
  await capture(page, testInfo, "07-local-data-error");

  await page.getByRole("button", { name: "Erase local data" }).click();
  await expect(page.getByRole("dialog", { name: "Erase local data?" })).toBeVisible();
  await capture(page, testInfo, "08-erasure-confirmation");
});

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function mountLongContent(page: Page): Promise<void> {
  await page.evaluate(async ({ fixturePath, ranksPath }) => {
    const [{ mountApp }, { rankForLevel }] = await Promise.all([
      import(fixturePath),
      import(ranksPath),
    ]);
    const level = 1_000_000;
    const rank = rankForLevel(level);
    const todo = {
      id: "long-content",
      text: "界".repeat(280),
      status: "active" as const,
      creationOrder: 0,
      completionOrder: null,
      createdAt: 0,
      updatedAt: 0,
      completedAt: null,
    };
    const projection = {
      activeTodos: [todo],
      standbyTodos: { items: [], hasMore: false, nextCursor: null },
      completedTodos: { items: [], hasMore: false, nextCursor: null },
      standbyCount: 0,
      completedCount: 0,
      lifetimeXp: 1,
      progression: {
        level,
        currentLevelThreshold: 0,
        nextLevelThreshold: 2,
        xpForCurrentLevel: 1,
        xpForNextLevel: 1,
      },
      rank,
      activeCapacity: 16,
      rewardHud: { link: null, combo: null },
    };
    mountApp({
      initialize: async () => ({ ok: true, projection }),
      getProjection: async () => projection,
      getSummaryProjection: async () => projection,
      getTodoPage: async () => ({ items: [], hasMore: false, nextCursor: null }),
      addTodo: async () => { throw new Error("Not used"); },
      editTodo: async () => { throw new Error("Not used"); },
      setTodoCompleted: async () => { throw new Error("Not used"); },
      deleteTodo: async () => { throw new Error("Not used"); },
      restoreDeletedTodo: async () => { throw new Error("Not used"); },
      eraseLocalData: async () => { throw new Error("Not used"); },
      close: () => undefined,
    });
  }, {
    fixturePath: "http://127.0.0.1:4174/mount-app.js",
    ranksPath: "http://127.0.0.1:4174/ranks.js",
  });
  await expect(page.getByRole("heading", { name: "Active Bay" })).toBeVisible();
}

async function mountLocalDataError(page: Page): Promise<void> {
  await page.evaluate(async (fixturePath) => {
    const { mountApp } = await import(fixturePath);
    mountApp({
      initialize: async () => ({
        ok: false,
        category: "local-data" as const,
        technicalCategory: "invalid-todo" as const,
        message: "Local data could not be opened." as const,
        retryable: true as const,
      }),
      getProjection: async () => { throw new Error("Not used"); },
      getSummaryProjection: async () => { throw new Error("Not used"); },
      getTodoPage: async () => { throw new Error("Not used"); },
      addTodo: async () => { throw new Error("Not used"); },
      editTodo: async () => { throw new Error("Not used"); },
      setTodoCompleted: async () => { throw new Error("Not used"); },
      deleteTodo: async () => { throw new Error("Not used"); },
      restoreDeletedTodo: async () => { throw new Error("Not used"); },
      eraseLocalData: async () => { throw new Error("Not used"); },
      close: () => undefined,
    });
  }, "http://127.0.0.1:4174/mount-app.js");
}
