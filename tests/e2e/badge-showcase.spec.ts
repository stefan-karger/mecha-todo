import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the temporary badge inspection route", async ({ page }, testInfo) => {
  await page.goto("/badge");

  await expect(page).toHaveTitle("Badge inspection bench | MECHA//TODO");
  await expect(page.getByRole("heading", { level: 1, name: "Badge inspection bench" })).toBeVisible();
  await expect(page.locator(".badge-matrix .rank-badge")).toHaveCount(45);
  await expect(page.locator(".atom-rack .rank-badge")).toHaveCount(8);
  await expect(page.locator(".badge-stress-rack .rank-badge")).toHaveCount(5);
  await expect(page.getByText("Prime-Omega-Apex-Eternal Marshal", { exact: true })).toBeVisible();

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
  await page.getByRole("heading", { name: "Rendering calibration" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Rendering calibration" })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("badge-mobile.png"), fullPage: true });
});
