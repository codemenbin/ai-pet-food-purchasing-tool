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

test("月龄输入可被修改并联动阶段（回归测试）", async ({ page }) => {
  await page.goto("/recommend");

  const ageInput = page.getByTestId("pet-age-months");
  await expect(ageInput).toBeVisible();

  // 清空再填：模拟用户从 48 改成 6（应联动到 puppy）
  await ageInput.fill("6");
  await expect(ageInput).toHaveValue("6");

  // 阶段下拉应联动到 puppy
  await expect(page.getByTestId("pet-stage")).toHaveValue("puppy");

  // 再改成 120（应联动到 senior）
  await ageInput.fill("120");
  await expect(ageInput).toHaveValue("120");
  await expect(page.getByTestId("pet-stage")).toHaveValue("senior");

  // 提交验证推荐请求里 ageMonths 是新值
  await page.getByTestId("allergen-chicken").click();
  const reqPromise = page.waitForRequest((req) => req.url().includes("/api/recommend") && req.method() === "POST");
  await page.getByTestId("submit-recommend").click();
  const req = await reqPromise;
  const body = JSON.parse(req.postData() || "{}");
  expect(body.pet.ageMonths).toBe(120);
  expect(body.pet.ageStage).toBe("senior");
});
