import { describe, expect, it } from "vitest";
import { getMockResponse } from "@/lib/llm.mock";

describe("getMockResponse", () => {
  it("识别推荐 prompt", () => {
    const r = getMockResponse("为 cat 推荐一些商品", {});
    const obj = JSON.parse(r);
    expect(Array.isArray(obj.recommendations)).toBe(true);
    expect(obj.recommendations.length).toBeGreaterThan(0);
    expect(typeof obj.summary).toBe("string");
  });

  it("识别对比 prompt", () => {
    const r = getMockResponse("配料表对比 productIds=a,b", {});
    const obj = JSON.parse(r);
    expect(Array.isArray(obj.ranking)).toBe(true);
    expect(typeof obj.verdict).toBe("string");
  });

  it("识别狗推荐", () => {
    const r = getMockResponse("为 dog 推荐商品", {});
    const obj = JSON.parse(r);
    expect(obj.recommendations[0].productId).toMatch(/^royal-canin|hills|orijen|taste|acana-freerunner/);
  });

  it("检测宠物信息块的物种（修复 bug：候选 ID 中含 cat 不再误判）", () => {
    // 模拟完整 prompt：包含【宠物信息】物种=狗，以及候选商品中有 acana-cat-adult
    const prompt = "【宠物信息】\n- 物种: 狗\n- 品种: X\n【候选商品】\n[{\"id\":\"acana-cat-adult\"}]\n";
    const r = getMockResponse(prompt + "为你的宠物推荐", {});
    const obj = JSON.parse(r);
    // 应当返回狗粮（不能因为候选里有 cat ID 就误判为猫）
    expect(obj.recommendations[0].productId).toMatch(/^royal-canin|hills|orijen|taste|acana-freerunner/);
  });

  it("推荐给猫", () => {
    const prompt = "【宠物信息】\n- 物种: 猫\n【候选商品】\n[]\n推荐";
    const r = getMockResponse(prompt, {});
    const obj = JSON.parse(r);
    expect(obj.recommendations[0].productId).toMatch(/^acana-cat|wellness-core|pureluxe|pro-plan|ziwi-peak/);
  });

  it("兜底响应", () => {
    const r = getMockResponse("随便说点啥", {});
    const obj = JSON.parse(r);
    expect(obj.recommendations).toBeDefined();
    expect(obj.recommendations.length).toBeGreaterThan(0);
  });
});
