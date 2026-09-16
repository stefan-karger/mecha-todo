import { expect, test, type Page } from "@playwright/test";

test("shows first-completion XP, every COMBO state, re-completion, and retained XP", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Open Progression details\. Level 0, Cadet/ })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await expect(page.getByText("Active 0 / 8", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(1);

  for (let ordinal = 1; ordinal <= 20; ordinal += 1) {
    const text = `Reward task ${ordinal}`;
    await page.getByRole("textbox", { name: "New task" }).fill(text);
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("checkbox", { name: `Complete ${text}` }).click();

    if (ordinal === 1) {
      await expect(page.getByRole("status")).toContainText("TASK COMPLETE · +10 XP · LEVEL 1");
      await expect(page.getByRole("button", { name: /Level 1, Cadet/ })).toBeVisible();
    }

    const nextCombo = new Map([[4, 5], [9, 10], [14, 15], [19, 20]]).get(ordinal);
    if (nextCombo) {
      await expect(page.getByText(`COMBO ${ordinal}/${nextCombo}`, { exact: true })).toBeVisible();
    }

    const comboBonus = new Map([[5, 2], [10, 4], [15, 6], [20, 8]]).get(ordinal);
    if (comboBonus) {
      await expect(page.getByRole("status")).toContainText(`COMBO +${comboBonus}`);
    }

    await expect(
      page.locator(".active-bay").getByRole("button", { name: text, exact: true }),
    ).toHaveCount(0);
  }

  await page.getByRole("button", { name: /^Completed/ }).click();
  await page.getByRole("checkbox", { name: "Reopen Reward task 20" }).click();
  await expect(page.getByRole("status")).toContainText("TASK REOPENED · XP RETAINED");
  await page.getByRole("checkbox", { name: "Complete Reward task 20" }).click();
  await expect(page.getByRole("status")).toContainText("TASK COMPLETE · ALREADY CREDITED");

  await page.getByRole("button", { name: "Delete Reward task 20" }).click();
  await expect(page.getByRole("status")).toContainText("TASK DELETED · XP RETAINED");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("220", { exact: true })).toBeVisible();
});

test("derives LINK READY and LINK ACTIVE from browser-local calendar awards", async ({ page }) => {
  await mountLinkedDayRepository(page);

  await expect(page.getByText("LINK READY", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "New task" }).fill("Linked day task");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("checkbox", { name: "Complete Linked day task" }).click();
  await expect(page.getByRole("status")).toContainText("TASK COMPLETE · +15 XP · LINK +5");
  await expect(page.getByText("LINK ACTIVE", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^Completed/ }).click();
  await page.getByRole("button", { name: "Delete Linked day task" }).click();
  await expect(page.getByText("LINK ACTIVE", { exact: true })).toBeVisible();
});

test("presents committed rank, capacity, and multi-slot promotion in one result", async ({ page }) => {
  await mountRankTransitionRepository(page);

  await expect(page.getByRole("button", { name: /Level 4, Cadet/ })).toBeVisible();
  await expect(page.getByText("Active 8 / 8", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Complete Active 0" }).click();

  await expect(page.getByRole("status")).toContainText(
    "RANK TROOPER · CAPACITY 9 · 2 STANDBY TASKS PROMOTED",
  );
  await expect(page.getByRole("button", { name: /Level 5, Trooper/ })).toBeVisible();
  await expect(page.getByText("Active 9 / 9", { exact: true })).toBeVisible();
  await expect(
    page.locator(".active-bay").getByRole("button", { name: "Standby 0", exact: true }),
  ).toBeVisible();
});

test("renders hidden crisp SVG badges at compact and detail sizes with canonical rank text", async ({ page }) => {
  await page.goto("/");

  const compactBadge = page.locator(".hud .rank-badge");
  await expect(compactBadge.locator("svg")).toHaveAttribute("viewBox", "0 0 32 32");
  await expect(compactBadge.locator("svg")).toHaveAttribute("shape-rendering", "crispEdges");
  await expect(compactBadge.locator("svg")).toHaveAttribute("aria-hidden", "true");
  const compactBox = await compactBadge.boundingBox();
  expect(compactBox?.width).toBeGreaterThanOrEqual(44);
  expect(compactBox?.width).toBeLessThanOrEqual(52);

  await page.getByRole("button", { name: /Open Progression details for Cadet/ }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toContainText("Cadet");
  const detailBox = await page.locator(".settings-dialog .rank-badge").boundingBox();
  expect(detailBox?.width).toBeGreaterThan(compactBox?.width ?? 0);
});

test("shows Settings sections, confirms erasure, and manages desktop and mobile focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "New task" }).fill("Keep until erased");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("textbox", { name: "New task" }).fill("unfinished draft");

  const settingsButton = page.getByRole("button", { name: "Settings" });
  await settingsButton.click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  await expect(settings).toContainText("Browser-local data");
  await expect(settings).toContainText("cannot move between browser profiles, devices, or website addresses");
  await expect(settings).toContainText("Application");
  await expect(settings).toContainText("Database schema");
  await expect(settings).toContainText("Reward rules");
  expect((await settings.boundingBox())?.width).toBeLessThanOrEqual(620);

  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(settingsButton).toBeFocused();

  await settingsButton.click();
  await settings.getByRole("button", { name: "Erase local data" }).click();
  const confirmation = page.getByRole("dialog", { name: "Erase local data?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Keep until erased", exact: true })).toBeAttached();
  await expect(page.getByRole("textbox", { name: "New task" })).toHaveValue("unfinished draft");

  await settings.getByRole("button", { name: "Erase local data" }).click();
  await confirmation.getByRole("button", { name: "Erase local data" }).click();
  await expect(page.getByRole("button", { name: /Level 0, Cadet/ })).toBeVisible();
  await expect(page.getByText("Active 0 / 8", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New task" })).toHaveValue("");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(settings.getByRole("button", { name: "Back" })).toBeVisible();
  const mobileBox = await settings.boundingBox();
  expect(mobileBox?.x).toBe(0);
  expect(mobileBox?.y).toBe(0);
  expect(mobileBox?.height).toBe(844);
  await settings.getByRole("button", { name: "Back" }).click();
  await expect(settings).toBeHidden();
});

async function mountLinkedDayRepository(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async ({ databasePath, repositoryPath, fixturePath }) => {
    const { openVersionedDatabase } = await import(databasePath);
    const { IndexedDbAppRepository } = await import(repositoryPath);
    const { mountApp } = await import(fixturePath);
    const name = `mecha-todo-link-ui-${crypto.randomUUID()}`;
    const opened = await openVersionedDatabase({ name, createdAt: 1 });
    if (!opened.ok) throw new Error(opened.category);
    await opened.database.put("completionAwards", {
      todoId: "deleted-yesterday",
      awardedAt: 1,
      dayKey: "2026-09-14",
      dailyOrdinal: 1,
      baseXp: 10,
      linkBonus: 0,
      comboBonus: 0,
      totalXp: 10,
      rulesVersion: 1,
    });
    await opened.database.put("meta", { key: "derived-stats", lifetimeXp: 10, awardCount: 1 });
    opened.database.close();
    mountApp(new IndexedDbAppRepository({
      databaseName: name,
      clock: () => 100,
      calendar: () => ({ year: 2026, month: 9, day: 15 }),
      idFactory: () => "linked-day-task",
    }));
  }, {
    databasePath: "/src/persistence/db.ts",
    repositoryPath: "/src/persistence/repository.ts",
    fixturePath: "/tests/fixtures/mount-app.ts",
  });
  await expect(page.getByRole("heading", { name: "Active Bay" })).toBeVisible();
}

async function mountRankTransitionRepository(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async ({ databasePath, repositoryPath, fixturePath }) => {
    const { openVersionedDatabase } = await import(databasePath);
    const { IndexedDbAppRepository } = await import(repositoryPath);
    const { mountApp } = await import(fixturePath);
    const name = `mecha-todo-rank-ui-${crypto.randomUUID()}`;
    const opened = await openVersionedDatabase({ name, createdAt: 1 });
    if (!opened.ok) throw new Error(opened.category);
    const transaction = opened.database.transaction(["todos", "completionAwards", "meta"], "readwrite");
    for (let index = 0; index < 8; index += 1) {
      await transaction.objectStore("todos").add({
        id: `active-${index}`,
        text: `Active ${index}`,
        status: "active",
        creationOrder: index,
        completionOrder: null,
        createdAt: index,
        updatedAt: index,
        completedAt: null,
      });
    }
    for (let index = 0; index < 2; index += 1) {
      await transaction.objectStore("todos").add({
        id: `standby-${index}`,
        text: `Standby ${index}`,
        status: "standby",
        creationOrder: index + 8,
        completionOrder: null,
        createdAt: index + 8,
        updatedAt: index + 8,
        completedAt: null,
      });
    }
    const awards = [
      ["history-0", "2026-09-14", 1, 0, 0, 10],
      ["history-1", "2026-09-15", 1, 5, 0, 15],
      ["history-2", "2026-09-15", 2, 0, 0, 10],
      ["history-3", "2026-09-15", 3, 0, 0, 10],
      ["history-4", "2026-09-15", 4, 0, 0, 10],
      ["history-5", "2026-09-15", 5, 0, 2, 12],
    ] as const;
    for (const [todoId, dayKey, dailyOrdinal, linkBonus, comboBonus, totalXp] of awards) {
      await transaction.objectStore("completionAwards").add({
        todoId,
        awardedAt: dailyOrdinal,
        dayKey,
        dailyOrdinal,
        baseXp: 10,
        linkBonus,
        comboBonus,
        totalXp,
        rulesVersion: 1,
      });
    }
    await transaction.objectStore("meta").put({
      key: "core",
      createdAt: 1,
      rulesVersion: 1,
      nextCreationOrder: 10,
      nextCompletionOrder: 0,
    });
    await transaction.objectStore("meta").put({ key: "derived-stats", lifetimeXp: 67, awardCount: 6 });
    await transaction.done;
    opened.database.close();
    mountApp(new IndexedDbAppRepository({
      databaseName: name,
      clock: () => 100,
      calendar: () => ({ year: 2026, month: 9, day: 15 }),
    }));
  }, {
    databasePath: "/src/persistence/db.ts",
    repositoryPath: "/src/persistence/repository.ts",
    fixturePath: "/tests/fixtures/mount-app.ts",
  });
  await expect(page.getByRole("heading", { name: "Active Bay" })).toBeVisible();
}
