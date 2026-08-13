import { test, expect } from "@playwright/test";

test("配料对比：2 款商品", async ({ page }) => {
  await page.goto("/compare");

  // 选 2 款猫粮
  await page.getByTestId("picker-checkbox-acana-cat-adult").check();
  await page.getByTestId("picker-checkbox-wellness-core-grain-free-cat").check();

  await page.getByTestId("submit-compare").click();

  await expect(page.getByTestId("comparison-table")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("verdict")).toBeVisible();
  await expect(page.getByTestId("score-acana-cat-adult")).toBeVisible();

  await page.screenshot({ path: "tests/e2e/screenshots/compare.png", fullPage: true });
});

test("配料对比：3 款商品", async ({ page }) => {
  await page.goto("/compare");

  await page.getByTestId("picker-checkbox-acana-cat-adult").check();
  await page.getByTestId("picker-checkbox-wellness-core-grain-free-cat").check();
  await page.getByTestId("picker-checkbox-pureluxe-grain-free-cat").check();

  await page.getByTestId("submit-compare").click();

  await expect(page.getByTestId("comparison-table")).toBeVisible({ timeout: 10_000 });
  // 3 款应有 3 个评分卡
  await expect(page.getByTestId("score-acana-cat-adult")).toBeVisible();
  await expect(page.getByTestId("score-wellness-core-grain-free-cat")).toBeVisible();
  await expect(page.getByTestId("score-pureluxe-grain-free-cat")).toBeVisible();
});
