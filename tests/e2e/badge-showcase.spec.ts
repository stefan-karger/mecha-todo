import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the temporary badge inspection route", async ({ page }, testInfo) => {
  await page.goto("/badge");

  await expect(page).toHaveTitle("Badge review | MECHA//TODO");
  await expect(page.getByRole("heading", { level: 1, name: "Badge review" })).toBeVisible();
  await expect(page.locator(".badge-comparisons .rank-badge")).toHaveCount(18);
  await expect(page.locator(".badge-pip-list .rank-badge")).toHaveCount(40);
  await expect(page.locator(".badge-size-list .rank-badge")).toHaveCount(54);
  await expect(page.locator(".badge-marshal-samples .rank-badge")).toHaveCount(2);
  await expect(page.getByText(/Designation artwork is pending ticket 03/)).toBeVisible();

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("badge-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "Return to tasks" })).toBeVisible();
  const pageMetrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(pageMetrics.scrollWidth).toBe(pageMetrics.clientWidth);
  expect(pageMetrics.scrollHeight).toBeGreaterThan(pageMetrics.clientHeight);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("heading", { name: "Size checks" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Size checks" })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("badge-mobile.png"), fullPage: true });
});
