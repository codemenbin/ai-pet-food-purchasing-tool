import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ProductSchema, PetInfoSchema, CompareResponseSchema, RecommendResponseSchema } from "@/types";

const productsData = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/data/products.json"), "utf-8")
);

describe("products.json 数据完整性", () => {
  it("至少 8 款商品", () => {
    expect(productsData.length).toBeGreaterThanOrEqual(8);
  });

  it("所有商品通过 ProductSchema 校验", () => {
    for (const p of productsData) {
      const r = ProductSchema.safeParse(p);
      expect(r.success, "商品 " + (p as { id?: string }).id + " 校验失败").toBe(true);
    }
  });

  it("id 唯一", () => {
    const ids = productsData.map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("覆盖 cat 与 dog", () => {
    const species = new Set(productsData.map((p: { species: string }) => p.species));
    expect(species.has("cat")).toBe(true);
    expect(species.has("dog")).toBe(true);
  });

  it("覆盖 puppy / adult / senior", () => {
    const stages = new Set(productsData.map((p: { lifeStage: string }) => p.lifeStage));
    expect(stages.has("puppy")).toBe(true);
    expect(stages.has("adult")).toBe(true);
    expect(stages.has("senior")).toBe(true);
  });

  it("至少 2 款商品包含鸡过敏原（演示用）", () => {
    const chickenCount = productsData.filter((p: { allergens: string[] }) =>
      p.allergens.includes("chicken")
    ).length;
    expect(chickenCount).toBeGreaterThanOrEqual(2);
  });

  it("至少 2 款商品不支持跨境（演示红黄绿）", () => {
    const noBorder = productsData.filter((p: { crossBorderAvailable: boolean }) => !p.crossBorderAvailable).length;
    expect(noBorder).toBeGreaterThanOrEqual(2);
  });

  it("营养数值在合法范围", () => {
    for (const p of productsData) {
      const nutrition = (p as { nutrition: Record<string, number> }).nutrition;
      for (const [k, v] of Object.entries(nutrition)) {
        expect(v, (p as { id: string }).id + ".nutrition." + k).toBeGreaterThanOrEqual(0);
        expect(v, (p as { id: string }).id + ".nutrition." + k).toBeLessThanOrEqual(10000);
      }
    }
  });
});

describe("PetInfoSchema", () => {
  it("合法数据通过", () => {
    const r = PetInfoSchema.safeParse({
      species: "cat",
      breed: "Persian",
      ageStage: "adult",
      ageMonths: 36,
      weightKg: 4,
      knownAllergens: ["chicken"],
      monthlyBudgetCNY: 400,
      destinationCountry: "中国大陆",
    });
    expect(r.success).toBe(true);
  });

  it("必填字段缺失", () => {
    const r = PetInfoSchema.safeParse({ species: "cat" });
    expect(r.success).toBe(false);
  });

  it("knownAllergens 可省略（默认空数组）", () => {
    const r = PetInfoSchema.safeParse({
      species: "cat",
      breed: "X",
      ageStage: "adult",
      weightKg: 4,
      monthlyBudgetCNY: 400,
      destinationCountry: "CN",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.knownAllergens).toEqual([]);
  });

  it("ageMonths 可省略（默认 48）", () => {
    const r = PetInfoSchema.safeParse({
      species: "cat",
      breed: "X",
      ageStage: "adult",
      weightKg: 4,
      monthlyBudgetCNY: 400,
      destinationCountry: "CN",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ageMonths).toBe(48);
  });

  it("ageMonths 超出 [0, 360] 范围拒绝", () => {
    const r1 = PetInfoSchema.safeParse({
      species: "cat", breed: "X", ageStage: "adult", ageMonths: -1,
      weightKg: 4, monthlyBudgetCNY: 400, destinationCountry: "CN"
    });
    expect(r1.success).toBe(false);

    const r2 = PetInfoSchema.safeParse({
      species: "cat", breed: "X", ageStage: "adult", ageMonths: 400,
      weightKg: 4, monthlyBudgetCNY: 400, destinationCountry: "CN"
    });
    expect(r2.success).toBe(false);
  });
});

describe("CompareResponseSchema 接受 2/3 款商品", () => {
  const base = {
    verdict: "x",
    ranking: ["a", "b"],
    nutritionDiffs: [],
    allergenMatrix: [],
    scores: [],
    source: "rule" as const,
  };

  it("2 款合法", () => {
    const r = CompareResponseSchema.safeParse({ ...base, productIds: ["a", "b"], ranking: ["a", "b"] });
    expect(r.success).toBe(true);
  });

  it("3 款合法", () => {
    const r = CompareResponseSchema.safeParse({ ...base, productIds: ["a", "b", "c"], ranking: ["a", "b", "c"] });
    expect(r.success).toBe(true);
  });

  it("1 款非法", () => {
    const r = CompareResponseSchema.safeParse({ ...base, productIds: ["a"], ranking: ["a"] });
    expect(r.success).toBe(false);
  });

  it("4 款非法", () => {
    const r = CompareResponseSchema.safeParse({ ...base, productIds: ["a", "b", "c", "d"], ranking: ["a", "b", "c", "d"] });
    expect(r.success).toBe(false);
  });
});

describe("RecommendResponseSchema", () => {
  it("合法", () => {
    const r = RecommendResponseSchema.safeParse({
      recommendations: [
        { productId: "a", rank: 1, score: 80, reason: "ok" },
      ],
      summary: "summary",
      source: "rule",
    });
    expect(r.success).toBe(true);
  });
});

