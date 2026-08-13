import { describe, expect, it } from "vitest";
import {
  buildCompareResponse,
  computeAllergenMatrix,
  computeNutritionDiffs,
  defaultVerdict,
  isSignificantDeviation,
  scoreProducts,
} from "@/lib/comparator";
import type { PetInfo, Product } from "@/types";

const mkProduct = (over: Partial<Product> = {}): Product => ({
  id: over.id ?? "test-product",
  brand: over.brand ?? "TestBrand",
  name: over.name ?? "Test Food",
  species: over.species ?? "cat",
  lifeStage: over.lifeStage ?? "adult",
  packageSize: over.packageSize ?? { value: 1, unit: "kg" },
  pricePerUnit: over.pricePerUnit ?? 100,
  crossBorderAvailable: over.crossBorderAvailable ?? true,
  origin: over.origin ?? "Testland",
  ingredients: over.ingredients ?? ["chicken", "rice"],
  nutrition: over.nutrition ?? {
    protein: 30, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800,
  },
  additives: over.additives ?? {},
  allergens: over.allergens ?? ["chicken"],
  weightRange: over.weightRange,
  notes: over.notes,
});

const mkPet = (over: Partial<PetInfo> = {}): PetInfo => ({
  species: over.species ?? "cat",
  breed: over.breed ?? "Test",
  ageStage: over.ageStage ?? "adult",
  ageMonths: over.ageMonths ?? 48,
  weightKg: over.weightKg ?? 4,
  knownAllergens: over.knownAllergens ?? [],
  monthlyBudgetCNY: over.monthlyBudgetCNY ?? 400,
  destinationCountry: over.destinationCountry ?? "CN",
});

describe("computeNutritionDiffs", () => {
  it("返回 6 个营养指标行", () => {
    const products = [mkProduct(), mkProduct({ id: "p2" })];
    const diffs = computeNutritionDiffs(products);
    expect(diffs).toHaveLength(6);
    expect(diffs.map((d) => d.metric).sort()).toEqual(
      ["ash", "calories", "fat", "fiber", "moisture", "protein"]
    );
  });

  it("相同商品偏差为 0", () => {
    const a = mkProduct({ id: "a", nutrition: { protein: 30, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800 } });
    const b = mkProduct({ id: "b", nutrition: { protein: 30, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800 } });
    const diffs = computeNutritionDiffs([a, b]);
    for (const row of diffs) {
      for (const v of row.values) {
        expect(v.deviationPct).toBe(0);
      }
    }
  });

  it("蛋白 30 vs 10 时偏差显著（>15%）", () => {
    const a = mkProduct({ id: "a", nutrition: { protein: 30, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800 } });
    const b = mkProduct({ id: "b", nutrition: { protein: 10, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800 } });
    const diffs = computeNutritionDiffs([a, b]);
    const proteinRow = diffs.find((d) => d.metric === "protein")!;
    const aVal = proteinRow.values.find((v) => v.productId === "a")!;
    expect(Math.abs(aVal.deviationPct)).toBeGreaterThan(15);
    expect(isSignificantDeviation("protein", aVal.deviationPct)).toBe(true);
  });

  it("蛋白 30 vs 28 偏差 <15%，不显著", () => {
    const a = mkProduct({ id: "a", nutrition: { protein: 30, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800 } });
    const b = mkProduct({ id: "b", nutrition: { protein: 28, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800 } });
    const diffs = computeNutritionDiffs([a, b]);
    const proteinRow = diffs.find((d) => d.metric === "protein")!;
    const aVal = proteinRow.values.find((v) => v.productId === "a")!;
    expect(isSignificantDeviation("protein", aVal.deviationPct)).toBe(false);
  });
});

describe("computeAllergenMatrix", () => {
  it("无过敏原时 hit 为空", () => {
    const p = mkProduct({ allergens: ["chicken"] });
    const pet = mkPet({ knownAllergens: ["beef"] });
    const matrix = computeAllergenMatrix([p], pet);
    expect(matrix[0].petAllergensHit).toEqual([]);
  });

  it("命中过敏原", () => {
    const p = mkProduct({ allergens: ["chicken", "wheat"] });
    const pet = mkPet({ knownAllergens: ["chicken"] });
    const matrix = computeAllergenMatrix([p], pet);
    expect(matrix[0].petAllergensHit).toContain("chicken");
  });

  it("大小写不敏感匹配", () => {
    const p = mkProduct({ allergens: ["Chicken"] });
    const pet = mkPet({ knownAllergens: ["chicken"] });
    const matrix = computeAllergenMatrix([p], pet);
    expect(matrix[0].petAllergensHit).toContain("Chicken");
  });
});

describe("scoreProducts", () => {
  it("完全匹配得 100", () => {
    const p = mkProduct({
      lifeStage: "adult",
      weightRange: { min: 3, max: 6, unit: "kg" },
      allergens: [],
      pricePerUnit: 100,
    });
    const pet = mkPet({ ageStage: "adult", weightKg: 4, knownAllergens: [], monthlyBudgetCNY: 400 });
    const scores = scoreProducts([p], pet);
    expect(scores[0].total).toBe(100);
    expect(scores[0].lifeStage).toBe(30);
    expect(scores[0].weightRange).toBe(20);
    expect(scores[0].allergen).toBe(30);
    expect(scores[0].price).toBe(20);
  });

  it("命中 2 个过敏原时 allergen=0", () => {
    const p = mkProduct({ allergens: ["chicken", "wheat"] });
    const pet = mkPet({ knownAllergens: ["chicken", "wheat"] });
    const scores = scoreProducts([p], pet);
    expect(scores[0].allergen).toBe(0);
  });

  it("all 阶段给 18 分而非 30", () => {
    const p = mkProduct({ lifeStage: "all" });
    const pet = mkPet({ ageStage: "puppy" });
    const scores = scoreProducts([p], pet);
    expect(scores[0].lifeStage).toBe(18);
  });

  it("价格超 50% 时 price=0", () => {
    const p = mkProduct({ pricePerUnit: 700 });
    const pet = mkPet({ monthlyBudgetCNY: 400 });
    const scores = scoreProducts([p], pet);
    expect(scores[0].price).toBe(0);
  });

  it("体重接近区间边缘得 10 分", () => {
    const p = mkProduct({ weightRange: { min: 5, max: 10, unit: "kg" } });
    const pet = mkPet({ weightKg: 4 }); // 差 1kg（<=5kg）
    const scores = scoreProducts([p], pet);
    expect(scores[0].weightRange).toBe(10);
  });
});

describe("defaultVerdict", () => {
  it("按 total 排序", () => {
    const scores = [
      { productId: "a", total: 80, lifeStage: 30, weightRange: 20, allergen: 30, price: 0, reasons: [] },
      { productId: "b", total: 95, lifeStage: 30, weightRange: 20, allergen: 30, price: 15, reasons: [] },
    ];
    const v = defaultVerdict(scores);
    expect(v.ranking[0]).toBe("b");
    expect(v.ranking[1]).toBe("a");
  });
});

describe("buildCompareResponse", () => {
  it("完整组装", () => {
    const a = mkProduct({ id: "a", pricePerUnit: 100 });
    const b = mkProduct({ id: "b", pricePerUnit: 150 });
    const pet = mkPet();
    const resp = buildCompareResponse(pet, [a, b]);
    expect(resp.productIds).toEqual(["a", "b"]);
    expect(resp.nutritionDiffs).toHaveLength(6);
    expect(resp.allergenMatrix).toHaveLength(2);
    expect(resp.scores).toHaveLength(2);
    expect(typeof resp.verdict).toBe("string");
    expect(resp.ranking.length).toBe(2);
    expect(resp.source).toBe("rule");
  });

  it("传入 llmPart 后 source = llm", () => {
    const a = mkProduct({ id: "a" });
    const b = mkProduct({ id: "b" });
    const pet = mkPet();
    const resp = buildCompareResponse(pet, [a, b], {
      verdict: "test verdict",
      ranking: ["a", "b"],
    });
    expect(resp.source).toBe("llm");
    expect(resp.verdict).toBe("test verdict");
  });
});
