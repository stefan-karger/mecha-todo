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
  await expect(page.getByRole("heading", { level: 1, name: PRODUCT_NAME })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "No active tasks. Add one when you are ready.",
  );

  const fontFamily = await page.locator("body").evaluate((element) =>
    getComputedStyle(element).fontFamily,
  );
  expect(fontFamily).toContain("JetBrains Mono Variable");
  expect(thirdPartyRequests).toEqual([]);

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations).toEqual([]);
});
