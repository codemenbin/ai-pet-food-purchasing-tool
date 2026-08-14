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

test("切猫狗 → 清空已选商品", async ({ page }) => {
  await page.goto("/compare");

  // 默认是猫，先选 2 款猫粮
  await page.getByTestId("picker-checkbox-acana-cat-adult").check();
  await page.getByTestId("picker-checkbox-wellness-core-grain-free-cat").check();
  await expect(page.getByTestId("picker-checkbox-acana-cat-adult")).toBeChecked();
  await expect(page.getByTestId("picker-checkbox-wellness-core-grain-free-cat")).toBeChecked();

  // 切成狗 → 已选商品必须清空
  await page.getByTestId("pet-species").selectOption("dog");
  await expect(page.getByTestId("picker-checkbox-acana-cat-adult")).not.toBeChecked();
  await expect(page.getByTestId("picker-checkbox-wellness-core-grain-free-cat")).not.toBeChecked();

  // 切回猫 → cat 商品列表重新出现，且 checkbox 都是未勾
  await page.getByTestId("pet-species").selectOption("cat");
  await expect(page.getByTestId("picker-checkbox-acana-cat-adult")).not.toBeChecked();
});

test("compare 页 modal 添加新商品 → 自动加入勾选", async ({ page }) => {
  await page.goto("/compare");

  // 默认猫
  await page.getByTestId("compare-add-product-link").click();
  await expect(page.getByTestId("add-product-modal")).toBeVisible();

  await page.getByTestId("modal-brand").fill("E2E猫粮品牌");
  await page.getByTestId("modal-name").fill("E2E猫粮单品");
  // 默认 species=cat、lifeStage=adult，无需改
  // DEMO_MODE 下 AI 解析走 rule-based，触发即可填默认值
  await page.getByTestId("modal-ai-parse").click();
  await expect(page.getByTestId("modal-parse-info")).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("modal-save").click();
  // 保存后 modal 自动关闭；新的 UserProduct 自动加入勾选
  await expect(page.getByTestId("add-product-modal")).not.toBeVisible();

  // 验证 "我的库" 顶部出现刚添加的商品（这里库中只 1 个）
  // 用 list 内的 item testid 找，注意 modal-saved list 的 testid 是 modal-saved-{id}
  // 退出 modal 后只能在 picker 列表里看，这里验证 picker 列表新增了一项
  // 因为 userProduct id 含时间戳后缀，这里校验至少多了一个勾选 checkbox
  // 用 submit-compare 启用条件反推 selectedIds >= 1
  // 实际上我们添加后 picker 上相应项应该自动 .checked()
  // 因为是新用户商品，列表中第一项就是它
  // 直接断言：第一项 picker-item-* 用户商品的 checkbox 是 checked
  const firstCheckbox = page.locator('[data-testid^="picker-checkbox-user-"][data-testid$="-cat"]').first();
  await expect(firstCheckbox).toBeChecked();
});


test("compare 页 modal 删除商品 → 自动从勾选移除", async ({ page }) => {
  await page.goto("/compare");

  // 打开 modal，添加一个 userProduct
  await page.getByTestId("compare-add-product-link").click();
  await expect(page.getByTestId("add-product-modal")).toBeVisible();

  await page.getByTestId("modal-brand").fill("E2EDeleteBrand");
  await page.getByTestId("modal-name").fill("E2EDeleteProduct");
  await page.getByTestId("modal-ai-parse").click();
  await expect(page.getByTestId("modal-parse-info")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("modal-save").click();
  await expect(page.getByTestId("add-product-modal")).not.toBeVisible();

  // userProduct 已自动勾选：第一项 user- 商品的 checkbox
  const userCheckbox = page
    .locator('[data-testid^="picker-checkbox-user-"]')
    .first();
  await expect(userCheckbox).toBeChecked();
  const userItem = page
    .locator('[data-testid^="picker-item-user-"]')
    .first();

  // 重新打开 modal 删除刚加的商品
  await page.getByTestId("compare-add-product-link").click();
  await expect(page.getByTestId("add-product-modal")).toBeVisible();

  // modal 内部"我的库"列表中找到我们刚加的那条，删除按钮定位为同 li 内按钮
  const savedRow = page
    .locator('[data-testid^="modal-saved-"]')
    .filter({ hasText: "E2EDeleteBrand" })
    .first();
  await expect(savedRow).toBeVisible();
  await savedRow.getByRole("button", { name: "删除" }).click();

  // 关闭 modal
  await page.getByTestId("modal-close").click();
  await expect(page.getByTestId("add-product-modal")).not.toBeVisible();

  // picker 中已无该商品（user- 项消失了）
  await expect(userItem).toHaveCount(0);
  // submit 按钮应该 disabled（无勾选）
  await expect(page.getByTestId("submit-compare")).toBeDisabled();
});