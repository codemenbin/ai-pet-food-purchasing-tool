import { test, expect } from "@playwright/test";

test("添加商品弹框：填品牌+名称+AI 解析+保存", async ({ page }) => {
  await page.goto("/recommend");

  // 打开弹框
  await page.getByTestId("add-product-link").click();
  await expect(page.getByTestId("add-product-modal")).toBeVisible();

  // 状态条渲染（demo / 真实 / 未配置 三态之一）
  await expect(page.getByTestId("modal-llm-status")).toBeVisible();

  // AI 解析按钮在 brand+name 为空时要禁用
  await expect(page.getByTestId("modal-ai-parse")).toBeDisabled();

  // 填 brand + name
  await page.getByTestId("modal-brand").fill("TestBrand");
  await page.getByTestId("modal-name").fill("TestFormula");
  await expect(page.getByTestId("modal-ai-parse")).toBeEnabled();

  // 触发 AI 解析（DEMO_MODE 走 rule-based）
  await page.getByTestId("modal-ai-parse").click();
  await expect(page.getByTestId("modal-parse-info")).toBeVisible({ timeout: 10_000 });

  // 降级提示：rule-based 路径会显示橙色 source-rule 标识
  await expect(page.getByTestId("modal-parse-source-rule")).toBeVisible();

  // 保存
  await page.getByTestId("modal-save").click();
  await expect(page.getByTestId("modal-saved")).toBeVisible();

  // 我的库列表里出现新商品
  await expect(page.getByText("TestBrand").first()).toBeVisible();

  await page.screenshot({ path: "tests/e2e/screenshots/add-product-modal.png", fullPage: true });
});

test("关闭弹框不保存", async ({ page }) => {
  await page.goto("/recommend");
  await page.getByTestId("add-product-link").click();
  await expect(page.getByTestId("add-product-modal")).toBeVisible();
  await page.getByTestId("modal-close").click();
  await expect(page.getByTestId("add-product-modal")).not.toBeVisible();
});
