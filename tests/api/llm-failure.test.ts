import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import { POST as recommendPOST } from "@/app/api/recommend/route";

/**
 * 真实 LLM 失败兜底测试 —— 验证用户报告的"AI 解析失败"场景下：
 *   - parseProduct 自动降级到 rule-based
 *   - 推荐路由 LLM 失败时降级到 recommendByRules
 *   - 即使 key 缺失 / 端点不可达 / 响应格式错，都不抛错
 */

const ORIG = { ...process.env };

describe("real LLM failure → graceful fallback", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    process.env.LLM_API_KEY = "sk-test-fake-key";
    process.env.LLM_BASE_URL = "https://invalid-host.example/v1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("parseProduct: network error → source=rule + warning + no Key leak", async () => {
    const llm = await import("@/lib/llm");
    const spy = vi.spyOn(llm, "callLLMMessages").mockRejectedValue(new Error("fetch failed: ENOTFOUND"));
    try {
      const { parseProduct } = await import("@/lib/productParser");
      const result = await parseProduct({ brand: "TestBrand", name: "TestFormula" });
      expect(result.source).toBe("rule");
      expect(result.confidence).toBeLessThanOrEqual(0.5);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w: string) => w.includes("LLM 解析失败") || w.includes("LLM"))).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/sk-test-fake-key/);
    } finally {
      spy.mockRestore();
    }
  });

  it("parseProduct: missing LLM_API_KEY → source=rule", async () => {
    const origKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    try {
      const llm = await import("@/lib/llm");
      const spy = vi.spyOn(llm, "callLLMMessages").mockImplementation(() => {
        throw new Error("LLM_API_KEY 未配置");
      });
      const { parseProduct } = await import("@/lib/productParser");
      const result = await parseProduct({ brand: "X", name: "Y" });
      expect(result.source).toBe("rule");
      expect(result.warnings.some((w: string) => w.includes("LLM") || w.includes("Key"))).toBe(true);
      spy.mockRestore();
    } finally {
      process.env.LLM_API_KEY = origKey;
    }
  });

  it("parseProduct: malformed LLM response → source=rule", async () => {
    const llm = await import("@/lib/llm");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue("not-json garbage");
    try {
      const { parseProduct } = await import("@/lib/productParser");
      const result = await parseProduct({ brand: "TestBrand", name: "TestFormula" });
      expect(result.source).toBe("rule");
      expect(result.warnings.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("parseProduct: LLM returns non-schema JSON → source=rule", async () => {
    const llm = await import("@/lib/llm");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(JSON.stringify({ product: { id: 1 }, warnings: "should be array" }));
    try {
      const { parseProduct } = await import("@/lib/productParser");
      const result = await parseProduct({ brand: "TestBrand", name: "TestFormula" });
      expect(result.source).toBe("rule");
      expect(result.warnings.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("recommend: network error → 200 + 至少 1 个推荐（rule-based fallback）", async () => {
    const llm = await import("@/lib/llm");
    const spy = vi.spyOn(llm, "callLLM").mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));
    try {
      await testApiHandler({
        appHandler: { POST: recommendPOST },
        async test({ fetch }) {
          const res = await fetch({
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              pet: {
                species: "dog",
                breed: "Labrador",
                ageStage: "adult",
                ageMonths: 36,
                weightKg: 15,
                knownAllergens: [],
                monthlyBudgetCNY: 500,
                destinationCountry: "CN",
              },
            }),
          });
          expect(res.status).toBe(200);
          const body = await res.json();
          expect(body.source).toMatch(/^(llm|rule)$/);
          expect(Array.isArray(body.recommendations)).toBe(true);
          expect(body.recommendations.length).toBeGreaterThan(0);
        },
      });
    } finally {
      spy.mockRestore();
    }
  });
});
