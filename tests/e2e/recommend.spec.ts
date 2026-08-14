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

test("加入对比按钮：点击后变 已加入，1.5s 后仍保持（不消失）", async ({ page }) => {
  await page.goto("/recommend");
  await page.getByTestId("submit-recommend").click();
  await expect(page.getByTestId("recommendation-list")).toBeVisible({ timeout: 10_000 });

  // 拿到第一个推荐
  const firstAddBtn = page.locator('[data-testid^="add-to-compare-"]').first();
  await expect(firstAddBtn).toContainText("加入对比");
  const productId = (await firstAddBtn.getAttribute("data-testid"))!.replace("add-to-compare-", "");

  // 点击 → 立即变 "已加入"
  await firstAddBtn.click();
  await expect(page.getByTestId(`add-to-compare-${productId}`)).toContainText("已加入");

  // 1.5s 后仍保持 "已加入"（不消失、不回到 "加入对比"）
  await page.waitForTimeout(2000);
  await expect(page.getByTestId(`add-to-compare-${productId}`)).toContainText("已加入");
});

test("加入对比按钮：再点击会移除（toggle 行为）", async ({ page }) => {
  await page.goto("/recommend");
  await page.getByTestId("submit-recommend").click();
  await expect(page.getByTestId("recommendation-list")).toBeVisible({ timeout: 10_000 });

  const firstAddBtn = page.locator('[data-testid^="add-to-compare-"]').first();
  const productId = (await firstAddBtn.getAttribute("data-testid"))!.replace("add-to-compare-", "");

  // 第一次点击：加入
  await firstAddBtn.click();
  await expect(page.getByTestId(`add-to-compare-${productId}`)).toContainText("已加入");

  // 第二次点击：移除（toggle）
  await page.getByTestId(`add-to-compare-${productId}`).click();
  await expect(page.getByTestId(`add-to-compare-${productId}`)).toContainText("加入对比");
});

test("进入推荐页时若 localStorage 已有对比项，按钮显示 已加入", async ({ page }) => {
  // 先访问页面预置 localStorage
  await page.goto("/recommend");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "ai-pet-food.compareSelection.v1",
      JSON.stringify(["royal-canin-puppy"])
    );
  });
  await page.reload();
  await page.getByTestId("submit-recommend").click();
  await expect(page.getByTestId("recommendation-list")).toBeVisible({ timeout: 10_000 });

  // royal-canin-puppy 如果在结果里，按钮应该是 "已加入"
  const btn = page.getByTestId("add-to-compare-royal-canin-puppy");
  const count = await btn.count();
  if (count > 0) {
    await expect(btn).toContainText("已加入");
  }
});