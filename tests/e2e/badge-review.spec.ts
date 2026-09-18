import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { BASE_RANKS } from "../../src/domain/ranks";

test("compares all nine reconstructed ranks with their source and preserves size-independent geometry", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/badge");
  const comparisons = page.locator(".badge-comparison");
  await expect(comparisons).toHaveCount(9);
  await expect(page.getByRole("heading", { name: "Prestige atoms" })).toHaveCount(0);
  await expect(page.getByText(/Designation artwork is pending/)).toBeVisible();
  await page.locator(".badge-concept-crop img").evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
  });
  await expect(page.locator('[data-rank="Colonel"] img')).toHaveAttribute("src", /badge-colonel-refined/);
  await expect(page.locator('[data-rank="Marshal"] img')).toHaveAttribute("src", /badge-marshal-refined/);
  for (const comparison of await comparisons.all()) {
    const svgs = comparison.locator("svg");
    await expect(svgs).toHaveCount(2);
    expect(await svgs.nth(0).innerHTML()).toBe(await svgs.nth(1).innerHTML());
  }
  const sizes = await page.locator(".badge-size-row:first-child .rank-badge").evaluateAll(
    (badges) => badges.map((badge) => badge.getBoundingClientRect().width),
  );
  expect(sizes).toEqual([24, 32, 44, 48, 96, 112]);
  for (const row of await page.locator(".badge-pip-row").all()) {
    const svgs = row.locator("svg");
    await expect(svgs).toHaveCount(5);
    for (let pip = 0; pip <= 4; pip++) {
      await expect(svgs.nth(pip)).toHaveAttribute("data-pips", String(pip));
      await expect(svgs.nth(pip).locator("rect")).toHaveCount(pip);
    }
  }
  await expect(page.locator(".badge-pip-row")).toHaveCount(8);
  await expect(page.locator(".badge-marshal-samples rect")).toHaveCount(0);

  // Measure actual geometry, not descriptor names or snapshot metadata.
  const geometry = await page.locator(".badge-comparison svg").evaluateAll(
    (svgs) => svgs.map((svg) => {
      const bounds = (svg as SVGSVGElement).getBBox();
      return { x: bounds.x, y: bounds.y, right: bounds.x + bounds.width, bottom: bounds.y + bounds.height };
    }),
  );
  expect(geometry).toHaveLength(18);
  for (const bounds of geometry) {
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(32);
    expect(bounds.bottom).toBeLessThanOrEqual(32);
  }
  for (const mode of ["Dark", "Light", "Grayscale"]) {
    await page.getByRole("radio", { name: mode, exact: true }).check();
    const path = testInfo.outputPath(`concept-comparison-${mode.toLowerCase()}.png`);
    await page.locator(".badge-comparisons").screenshot({ path, animations: "disabled" });
    await testInfo.attach(`concept-comparison-${mode.toLowerCase()}`, { path, contentType: "image/png" });
  }
  const sizePath = testInfo.outputPath("all-rank-size-checks.png");
  await page.locator(".badge-size-list").screenshot({ path: sizePath, animations: "disabled" });
  await testInfo.attach("all-rank-size-checks", { path: sizePath, contentType: "image/png" });
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`uses the same nine drawings in the actual HUD and details at ${width}px`, async ({ page }, testInfo) => {
    const conceptRequests: string[] = [];
    page.on("request", (request) => {
      if (/badge(?:s_concept|-colonel-refined|-marshal-refined)/.test(request.url())) {
        conceptRequests.push(request.url());
      }
    });
    await page.setViewportSize({ width, height: 900 });
    for (let index = 0; index < BASE_RANKS.length; index++) {
      await page.goto("/");
      await page.evaluate(async ({ level, fixturePath, ranksPath }) => {
        const [{ mountApp }, { rankForLevel }] = await Promise.all([import(fixturePath), import(ranksPath)]);
        const applicationViewState = {
          activeTodos: [], standbyCount: 0, completedCount: 0,
          progression: {
            level, lifetimeXp: 1000, currentLevelXp: 1000, nextLevelXp: 1100,
            xpForCurrentLevel: 0, xpForNextLevel: 100, progress: 0,
          },
          rank: rankForLevel(level), activeCapacity: 8,
          rewardHud: { link: null, combo: null },
        };
        const unused = async () => { throw new Error("Not used in badge review"); };
        mountApp({
          initialize: async () => ({ ok: true, applicationViewState }),
          getApplicationViewState: async () => applicationViewState,
          getTodoPage: async () => ({ items: [], hasMore: false, nextCursor: null }),
          addTodo: unused, editTodo: unused, setTodoCompleted: unused, deleteTodo: unused,
          restoreDeletedTodo: unused, eraseLocalData: unused, close: () => undefined,
        });
      }, {
        level: index * 5,
        fixturePath: "http://127.0.0.1:4174/mount-app.js",
        ranksPath: "http://127.0.0.1:4174/ranks.js",
      });
      const rank = BASE_RANKS[index];
      const button = page.getByRole("button", { name: `Open Progression details for ${rank}`, exact: true });
      await expect(button).toBeVisible();
      const compact = button.locator("svg");
      const compactGeometry = await compact.innerHTML();
      expect((await compact.boundingBox())?.width).toBe(width === 390 ? 44 : 48);
      const hudPath = testInfo.outputPath(`${rank}-hud.png`);
      await page.locator(".hud").screenshot({ path: hudPath, animations: "disabled" });
      await testInfo.attach(`${rank}-hud`, { path: hudPath, contentType: "image/png" });
      await button.click();
      const detail = page.locator(".settings-dialog .rank-badge svg");
      await expect(detail).toBeVisible();
      expect(await detail.innerHTML()).toBe(compactGeometry);
      expect((await detail.boundingBox())?.width).toBe(width === 390 ? 96 : 112);
      const detailPath = testInfo.outputPath(`${rank}-details.png`);
      await page.locator(".progression-details").screenshot({ path: detailPath, animations: "disabled" });
      await testInfo.attach(`${rank}-details`, { path: detailPath, contentType: "image/png" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    expect(conceptRequests).toEqual([]);
  });
}

test("renders the comparison at double pixel density", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/badge");
    await page.locator(".badge-concept-crop img").evaluateAll(async (images) => {
      await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
    });
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
    const path = testInfo.outputPath("concept-comparison-2x.png");
    await page.locator(".badge-comparisons").screenshot({ path, animations: "disabled" });
    await testInfo.attach("concept-comparison-2x", { path, contentType: "image/png" });
  } finally {
    await context.close();
  }
});

test("keeps badge review accessible at 320px and in forced colors", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/badge");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ forcedColors: "active" });
  const appearance = await page.locator(".badge-sample svg g").first().evaluate((group) => ({
    fill: getComputedStyle(group).fill,
    background: getComputedStyle(group.closest(".badge-sample")!).backgroundColor,
  }));
  expect(appearance.fill).not.toBe(appearance.background);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const path = testInfo.outputPath("mobile-forced-colors.png");
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach("mobile-forced-colors", { path, contentType: "image/png" });
});
