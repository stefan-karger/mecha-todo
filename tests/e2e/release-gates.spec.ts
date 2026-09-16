import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

test("keeps one responsive task hierarchy with long content at the release viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Active Bay" })).toBeVisible();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The release project must define a viewport.");

  const shell = page.locator(".app-shell");
  const shellBox = await shell.boundingBox();
  expect(shellBox?.width).toBeLessThanOrEqual(Math.min(viewport.width, 680));
  expect(shellBox?.height).toBeCloseTo(viewport.height, 0);

  const regions = await page.locator(".task-system").evaluate((main) => {
    const hud = main.querySelector<HTMLElement>(".hud");
    const scroll = main.querySelector<HTMLElement>(".task-scroll-region");
    const composer = main.querySelector<HTMLElement>(".composer-dock");
    if (!hud || !scroll || !composer) throw new Error("Task regions are missing.");
    return {
      hudPosition: getComputedStyle(hud).position,
      scrollOverflowX: getComputedStyle(scroll).overflowX,
      scrollOverflowY: getComputedStyle(scroll).overflowY,
      composerPosition: getComputedStyle(composer).position,
      order: [hud, scroll, composer].map((element) => element.getBoundingClientRect().top),
    };
  });
  expect(regions.scrollOverflowX).toBe("hidden");
  expect(regions.scrollOverflowY).toBe("auto");
  expect(regions.order[0]).toBeLessThan(regions.order[1]);
  expect(regions.order[1]).toBeLessThan(regions.order[2]);
  if (testInfo.project.name === "mobile-chrome") {
    expect(regions.hudPosition).toBe("sticky");
    expect(regions.composerPosition).toBe("sticky");
  } else {
    expect(regions.hudPosition).toBe("static");
    expect(regions.composerPosition).toBe("static");
  }

  const longTodo = "界".repeat(280);
  const composer = page.getByRole("textbox", { name: "New task" });
  await composer.fill(longTodo);
  await composer.press("Enter");
  const row = page.locator(".active-bay .todo-row");
  await expect(row).toContainText(longTodo);
  await expect(page.getByRole("button", { name: `Delete ${longTodo}` })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: `Complete ${longTodo}` })).toBeVisible();
  await assertInsideViewport(page, row);
  await assertNoHorizontalOverflow(page);

  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });
  await expect(page.getByRole("button", { name: `Delete ${longTodo}` })).toBeVisible();
  await assertInsideViewport(page, row);
  await assertNoHorizontalOverflow(page);

  await mountLongRank(page, longTodo);
  const rankButton = page.getByRole("button", { name: /Open Progression details\. Level/ });
  await expect(rankButton).toContainText("Marshal");
  await assertInsideViewport(page, rankButton);
  const longLayout = await page.locator(".task-system").evaluate((main) => {
    const hud = main.querySelector<HTMLElement>(".hud")?.getBoundingClientRect();
    const scroll = main.querySelector<HTMLElement>(".task-scroll-region")?.getBoundingClientRect();
    const composerDock = main.querySelector<HTMLElement>(".composer-dock")?.getBoundingClientRect();
    if (!hud || !scroll || !composerDock) throw new Error("Task regions are missing.");
    return {
      hudBottom: hud.bottom,
      scrollTop: scroll.top,
      scrollHeight: scroll.height,
      scrollBottom: scroll.bottom,
      composerTop: composerDock.top,
      composerBottom: composerDock.bottom,
    };
  });
  expect(longLayout.hudBottom).toBeLessThanOrEqual(longLayout.scrollTop + 0.5);
  expect(longLayout.scrollHeight).toBeGreaterThan(0);
  expect(longLayout.scrollBottom).toBeLessThanOrEqual(longLayout.composerTop + 0.5);
  expect(longLayout.composerBottom).toBeLessThanOrEqual(viewport.height + 0.5);
  await assertNoHorizontalOverflow(page);

  await rankButton.click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  await expect(settings.locator(".detailed-rank")).toContainText("Marshal");
  if (testInfo.project.name !== "mobile-chrome") {
    expect((await settings.boundingBox())?.width).toBeLessThanOrEqual(620);
  }
  await assertNoHorizontalOverflow(page);
});

test("supports keyboard focus, task-aware semantics, live feedback, and dialogs", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  const badge = page.getByRole("button", { name: /Open Progression details for Cadet/ });
  const rank = page.getByRole("button", { name: /Open Progression details\. Level 0, Cadet/ });
  const settingsTrigger = page.getByRole("button", { name: "Settings" });
  await page.locator("body").evaluate((body) => {
    const start = document.createElement("button");
    start.id = "keyboard-order-start";
    start.textContent = "Keyboard order start";
    body.prepend(start);
    start.focus();
  });
  await page.keyboard.press("Tab");
  await expect(badge).toBeFocused();
  await page.locator("#keyboard-order-start").evaluate((start) => start.remove());
  await page.keyboard.press("Tab");
  await expect(rank).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(settingsTrigger).toBeFocused();
  await page.keyboard.press("Enter");

  const settings = page.getByRole("dialog", { name: "Settings" });
  const closeName = testInfo.project.name === "mobile-chrome" ? "Back" : "Close";
  await expect(settings.getByRole("button", { name: closeName })).toBeFocused();
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("dialog")?.className)).toContain(
    "settings-dialog",
  );
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(settingsTrigger).toBeFocused();

  const composer = page.getByRole("textbox", { name: "New task" });
  await composer.fill("   ");
  await composer.press("Enter");
  await expect(composer).toHaveAttribute("aria-invalid", "true");
  await expect(composer).toHaveAttribute("aria-describedby", "composer-error");
  await expect(page.locator("#composer-error")).toHaveText("Enter a task.");
  await expect(page.getByRole("status")).toHaveText("Enter a task.");

  await composer.fill("Keyboard calibration");
  await composer.press("Enter");
  const status = page.getByRole("checkbox", { name: "Complete Keyboard calibration" });
  const taskText = page.getByRole("button", { name: "Keyboard calibration", exact: true });
  const deleteAction = page.getByRole("button", { name: "Delete Keyboard calibration" });
  await expect(status).toHaveAttribute("aria-checked", "false");
  await expect(taskText).toBeVisible();
  await expect(deleteAction).toBeVisible();

  const progress = page.getByRole("progressbar");
  await expect(progress).toHaveAttribute("max", "10");
  await expect(progress).toHaveAttribute("value", "0");
  await expect(progress).toHaveAttribute("aria-valuetext", /0 of 10 XP at level 0, Cadet/);

  await status.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("TASK COMPLETE · +10 XP");
  await expect(progress).toHaveAttribute("value", "0");
  await expect(progress).toHaveAttribute("aria-valuetext", /0 of 10 XP at level 1, Cadet/);

  await assertMinimumTargets(page, page.locator(".app-shell"));
  const pageAxe = await new AxeBuilder({ page }).analyze();
  expect(pageAxe.violations).toEqual([]);

  await settingsTrigger.click();
  await assertMinimumTargets(page, settings);
  const settingsAxe = await new AxeBuilder({ page }).include(".settings-dialog").analyze();
  expect(settingsAxe.violations).toEqual([]);

  const erase = settings.getByRole("button", { name: "Erase local data" });
  await erase.click();
  const confirmation = page.getByRole("dialog", { name: "Erase local data?" });
  await expect(confirmation).toBeVisible();
  await assertMinimumTargets(page, confirmation);
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(erase).toBeFocused();
});

test("preserves focus and state cues for reduced motion and forced colors", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const motion = await page.locator(".hud").evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  expect(motion.animationDuration).toBe("1e-05s");
  expect(motion.transitionDuration).toBe("1e-05s");

  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  const badge = page.getByRole("button", { name: /Open Progression details for Cadet/ });
  await badge.focus();
  const forced = await badge.evaluate((element) => {
    const focus = getComputedStyle(element);
    const hud = getComputedStyle(element.closest(".hud") as Element);
    return {
      borderBottomStyle: hud.borderBottomStyle,
      borderTopWidth: hud.borderTopWidth,
      outlineStyle: focus.outlineStyle,
      outlineWidth: focus.outlineWidth,
    };
  });
  expect(forced.borderBottomStyle).toBe("solid");
  expect(forced.borderTopWidth).toBe("2px");
  expect(forced.outlineStyle).toBe("solid");
  expect(Number.parseFloat(forced.outlineWidth)).toBeGreaterThanOrEqual(2);

  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(results.violations).toEqual([]);
});

test("keeps task content out of requests, URLs, titles, and console output", async ({ page }) => {
  const requests: Array<{ url: string; postData: string | null }> = [];
  const consoleMessages: string[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), postData: request.postData() }));
  page.on("console", (message) => consoleMessages.push(message.text()));

  await page.goto("/");
  const secret = `PRIVATE-TASK-${crypto.randomUUID()}`;
  const composer = page.getByRole("textbox", { name: "New task" });
  await composer.fill(secret);
  await composer.press("Enter");
  await expect(page.getByRole("button", { name: secret, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: secret, exact: true })).toBeVisible();

  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(new URL(request.url).origin).toBe("http://127.0.0.1:4173");
    expect(request.url).not.toContain(secret);
    expect(request.postData ?? "").not.toContain(secret);
  }
  expect(page.url()).not.toContain(secret);
  await expect(page).toHaveTitle("MECHA//TODO");
  expect(consoleMessages.join("\n")).not.toContain(secret);
});

async function assertMinimumTargets(page: Page, container: Locator): Promise<void> {
  const undersized = await container.locator("button:visible, input:visible").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      return box.width < 44 || box.height < 44
        ? [{ name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName, width: box.width, height: box.height }]
        : [];
    }),
  );
  expect(undersized).toEqual([]);
  await assertNoHorizontalOverflow(page);
}

async function assertInsideViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("The element or viewport has no box.");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function mountLongRank(page: Page, todoText: string): Promise<void> {
  await page.evaluate(async ({ text, fixturePath, ranksPath }) => {
    const [{ mountApp }, { rankForLevel }] = await Promise.all([
      import(fixturePath),
      import(ranksPath),
    ]);
    const level = 1_000_000;
    const rank = rankForLevel(level);
    const todo = {
      id: "long-content",
      text,
      status: "active" as const,
      creationOrder: 0,
      completionOrder: null,
      createdAt: 0,
      updatedAt: 0,
      completedAt: null,
    };
    const applicationViewState = {
      activeTodos: [todo],
      standbyCount: 0,
      completedCount: 0,
      progression: {
        level,
        lifetimeXp: 1,
        currentLevelXp: 0,
        nextLevelXp: 2,
        xpForCurrentLevel: 1,
        xpForNextLevel: 1,
        progress: 1,
      },
      rank,
      activeCapacity: 16,
      rewardHud: { link: null, combo: null },
    };
    mountApp({
      initialize: async () => ({ ok: true, applicationViewState }),
      getApplicationViewState: async () => applicationViewState,
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
    text: todoText,
    fixturePath: "http://127.0.0.1:4174/mount-app.js",
    ranksPath: "http://127.0.0.1:4174/ranks.js",
  });
  await expect(page.getByRole("heading", { name: "Active Bay" })).toBeVisible();
}
