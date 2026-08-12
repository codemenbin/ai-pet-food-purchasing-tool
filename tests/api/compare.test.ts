import { testApiHandler } from "next-test-api-route-handler";
import * as appHandler from "@/app/api/compare/route";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("POST /api/compare", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "1";
    process.env.LLM_MOCK = "1";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const validPet = {
    species: "cat",
    breed: "Persian",
    ageStage: "adult",
    weightKg: 4,
    knownAllergens: ["chicken"],
    monthlyBudgetCNY: 400,
    destinationCountry: "CN",
  };

  it("2 款商品合法", async () => {
    await testApiHandler({
      appHandler,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productIds: ["acana-cat-adult", "wellness-core-grain-free-cat"],
            pet: validPet,
          }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.productIds).toEqual(["acana-cat-adult", "wellness-core-grain-free-cat"]);
        expect(body.nutritionDiffs).toHaveLength(6);
        expect(body.allergenMatrix).toHaveLength(2);
        expect(body.scores).toHaveLength(2);
        expect(typeof body.verdict).toBe("string");
        expect(body.ranking.length).toBe(2);
      },
    });
  });

  it("3 款商品合法", async () => {
    await testApiHandler({
      appHandler,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productIds: [
              "acana-cat-adult",
              "wellness-core-grain-free-cat",
              "pureluxe-grain-free-cat",
            ],
            pet: validPet,
          }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.productIds.length).toBe(3);
        expect(body.ranking.length).toBe(3);
      },
    });
  });

  it("少于 2 款商品返回 400", async () => {
    await testApiHandler({
      appHandler,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productIds: ["acana-cat-adult"],
            pet: validPet,
          }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("超过 3 款商品返回 400", async () => {
    await testApiHandler({
      appHandler,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productIds: ["a", "b", "c", "d"],
            pet: validPet,
          }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("不存在 productId 返回 400", async () => {
    await testApiHandler({
      appHandler,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productIds: ["acana-cat-adult", "nonexistent-product"],
            pet: validPet,
          }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("物种不一致返回 400", async () => {
    await testApiHandler({
      appHandler,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productIds: ["acana-cat-adult", "royal-canin-puppy"],
            pet: validPet,
          }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});
