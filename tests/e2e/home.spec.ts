import { test, expect } from "@playwright/test";

test("首页加载与两个入口可见", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /为宠物挑选/ })).toBeVisible();
  await expect(page.getByTestId("card-recommend")).toBeVisible();
  await expect(page.getByTestId("card-compare")).toBeVisible();

  expect(errors).toEqual([]);
});
