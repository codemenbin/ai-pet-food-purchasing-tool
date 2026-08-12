import { test, expect } from "@playwright/test";

test("个性化推荐完整流程（DEMO_MODE）", async ({ page }) => {
  await page.goto("/recommend");

  // 默认值已足够；显式选鸡过敏
  await page.getByTestId("allergen-chicken").click();

  await page.getByTestId("submit-recommend").click();

  // 等待推荐列表出现
  await expect(page.getByTestId("recommendation-list")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "tests/e2e/screenshots/recommend.png", fullPage: true });
});
