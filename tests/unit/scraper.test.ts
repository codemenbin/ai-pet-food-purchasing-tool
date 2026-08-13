import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { fetchProducts } from "@/lib/scraper";

const ORIGINAL_ENV = { ...process.env };

describe("fetchProducts 三层回退", () => {
  describe("DEMO_MODE=1", () => {
    beforeAll(() => {
      process.env.DEMO_MODE = "1";
    });
    afterAll(() => {
      process.env = { ...ORIGINAL_ENV };
    });

    it("直接走 mock，跳过 live/cache", async () => {
      const r = await fetchProducts();
      expect(r.source).toBe("mock");
      expect(r.products.length).toBeGreaterThanOrEqual(8);
      expect(Array.isArray(r.errors)).toBe(true);
    });
  });

  describe("DEMO_MODE=0", () => {
    beforeAll(() => {
      delete process.env.DEMO_MODE;
    });
    afterAll(() => {
      process.env = { ...ORIGINAL_ENV };
    });

    it("live 无实现 + 无 cache → 回退 mock", async () => {
      const r = await fetchProducts();
      // 当前 scrapeLive 返回空，所以最终走 mock
      expect(r.source).toBe("mock");
      expect(r.errors.length).toBeGreaterThanOrEqual(1);
    });
  });
});

