import { testApiHandler } from "next-test-api-route-handler";
import { POST as recommendPOST } from "@/app/api/recommend/route";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("POST /api/recommend", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "1";
    process.env.LLM_MOCK = "1";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const basePet = {
    species: "cat",
    breed: "Persian",
    ageStage: "adult",
    ageMonths: 36,
    weightKg: 4,
    knownAllergens: ["chicken"],
    monthlyBudgetCNY: 400,
    destinationCountry: "CN",
  };

  it("合法参数返回推荐", async () => {
    await testApiHandler({
      appHandler: { POST: recommendPOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(basePet),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.recommendations)).toBe(true);
        expect(body.recommendations.length).toBeGreaterThanOrEqual(1);
        expect(typeof body.summary).toBe("string");
        expect(["mock", "llm", "rule"]).toContain(body.source);
      },
    });
  });

  it("狗物种返回狗粮（修复 bug：不能返回猫粮）", async () => {
    await testApiHandler({
      appHandler: { POST: recommendPOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...basePet, species: "dog" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.recommendations.length).toBeGreaterThan(0);
        // 推荐列表里不能出现猫粮 ID
        const ids: string[] = body.recommendations.map((r: { productId: string }) => r.productId);
        const hasCatFood = ids.some((id: string) => id.includes("cat"));
        expect(hasCatFood).toBe(false);
      },
    });
  });

  it("缺参数返回 400", async () => {
    await testApiHandler({
      appHandler: { POST: recommendPOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ species: "cat" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("非法 JSON 返回 400", async () => {
    await testApiHandler({
      appHandler: { POST: recommendPOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not-json",
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("物种 enum 校验", async () => {
    await testApiHandler({
      appHandler: { POST: recommendPOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            species: "fish",
            breed: "X",
            ageStage: "adult",
            weightKg: 4,
            monthlyBudgetCNY: 400,
            destinationCountry: "CN",
          }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});

