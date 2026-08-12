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

  it("兜底响应", () => {
    const r = getMockResponse("随便说点啥", {});
    const obj = JSON.parse(r);
    expect(obj.recommendations).toBeDefined();
    expect(obj.recommendations.length).toBeGreaterThan(0);
  });
});
