import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PRODUCT_NAME } from "../../src/config/product";

test("renders an accessible empty shell with bundled assets", async ({ page }) => {
  const thirdPartyRequests: string[] = [];

  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== "http://127.0.0.1:4173") {
      thirdPartyRequests.push(request.url());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle(PRODUCT_NAME);
  await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toHaveCount(0);
  await expect(page.locator(".product-header")).toHaveCount(0);
  await expect(page.getByRole("main", { name: "Tasks" })).toContainText(
    "Nothing active right now. Add a task when you're ready.",
  );
  const active = page.locator('button[aria-controls="active-tasks"]');
  await expect(active).toHaveAccessibleName(/Active/);
  await expect(active).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#active-tasks")).toBeVisible();
  const settings = page.getByRole("button", { name: "Settings" });
  await expect(settings).toHaveText("");
  await expect(settings.locator(".lucide-settings")).toHaveAttribute("aria-hidden", "true");

  const fontFamily = await page.locator("body").evaluate((element) =>
    getComputedStyle(element).fontFamily,
  );
  expect(fontFamily).toContain("JetBrains Mono Variable");
  expect(thirdPartyRequests).toEqual([]);

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations).toEqual([]);
});
