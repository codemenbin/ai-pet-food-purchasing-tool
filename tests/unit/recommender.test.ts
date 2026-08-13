import { describe, expect, it } from "vitest";
import { recommendByRules } from "@/lib/recommender";
import type { PetInfo, Product } from "@/types";

const mkProduct = (over: Partial<Product> = {}): Product => ({
  id: over.id ?? "p",
  brand: over.brand ?? "B",
  name: over.name ?? "N",
  species: over.species ?? "cat",
  lifeStage: over.lifeStage ?? "adult",
  packageSize: over.packageSize ?? { value: 1, unit: "kg" },
  pricePerUnit: over.pricePerUnit ?? 100,
  crossBorderAvailable: over.crossBorderAvailable ?? true,
  origin: over.origin ?? "X",
  ingredients: over.ingredients ?? ["chicken"],
  nutrition: over.nutrition ?? {
    protein: 30, fat: 15, fiber: 5, moisture: 10, ash: 7, calories: 3800,
  },
  additives: over.additives ?? {},
  allergens: over.allergens ?? [],
  weightRange: over.weightRange,
  notes: over.notes,
});

const mkPet = (over: Partial<PetInfo> = {}): PetInfo => ({
  species: over.species ?? "cat",
  breed: over.breed ?? "X",
  ageStage: over.ageStage ?? "adult",
  ageMonths: over.ageMonths ?? 48,
  weightKg: over.weightKg ?? 4,
  knownAllergens: over.knownAllergens ?? [],
  monthlyBudgetCNY: over.monthlyBudgetCNY ?? 400,
  destinationCountry: over.destinationCountry ?? "CN",
});

describe("recommendByRules", () => {
  it("按物种过滤", () => {
    const cat = mkProduct({ id: "cat1", species: "cat" });
    const dog = mkProduct({ id: "dog1", species: "dog" });
    const result = recommendByRules(mkPet({ species: "cat" }), [cat, dog]);
    expect(result.recommendations.every((r) => r.productId === "cat1")).toBe(true);
  });

  it("阶段不匹配被剔除", () => {
    const adult = mkProduct({ id: "adult", lifeStage: "adult" });
    const puppy = mkProduct({ id: "puppy", lifeStage: "puppy" });
    const result = recommendByRules(mkPet({ ageStage: "senior" }), [adult, puppy]);
    expect(result.recommendations).toHaveLength(0);
  });

  it("阶段 all 视为兼容", () => {
    const all = mkProduct({ id: "all", lifeStage: "all" });
    const result = recommendByRules(mkPet({ ageStage: "senior" }), [all]);
    expect(result.recommendations).toHaveLength(1);
  });

  it("命中过敏原被剔除（严格模式）", () => {
    const hit = mkProduct({ id: "hit", allergens: ["chicken"] });
    const safe = mkProduct({ id: "safe", allergens: [] });
    const result = recommendByRules(mkPet({ knownAllergens: ["chicken"] }), [hit, safe]);
    expect(result.recommendations.every((r) => r.productId !== "hit")).toBe(true);
  });

  it("价格超 1.5 倍预算被剔除", () => {
    const expensive = mkProduct({ id: "exp", pricePerUnit: 1000 });
    const cheap = mkProduct({ id: "cheap", pricePerUnit: 100 });
    const result = recommendByRules(mkPet({ monthlyBudgetCNY: 400 }), [expensive, cheap]);
    expect(result.recommendations.every((r) => r.productId !== "exp")).toBe(true);
  });

  it("返回 topN", () => {
    const products = Array.from({ length: 10 }, (_, i) => mkProduct({ id: `p${i}` }));
    const result = recommendByRules(mkPet(), products, { topN: 3 });
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].rank).toBe(1);
    expect(result.recommendations[1].rank).toBe(2);
    expect(result.recommendations[2].rank).toBe(3);
  });

  it("空结果时不崩溃", () => {
    const result = recommendByRules(mkPet({ species: "cat" }), [
      mkProduct({ id: "dog", species: "dog" }),
    ]);
    expect(result.recommendations).toEqual([]);
    expect(result.summary).toContain("未找到");
  });
});
