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
  origin: over.origin ?? "USA",
  ingredients: over.ingredients ?? ["chicken", "rice"],
  nutrition: over.nutrition ?? { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
  additives: over.additives ?? {},
  allergens: over.allergens ?? [],
  weightRange: over.weightRange,
  notes: over.notes,
});

const mkPet = (over: Partial<PetInfo> = {}): PetInfo => ({
  species: over.species ?? "cat",
  breed: over.breed ?? "Mixed",
  ageStage: over.ageStage ?? "adult",
  ageMonths: over.ageMonths ?? 36,
  weightKg: over.weightKg ?? 4,
  knownAllergens: over.knownAllergens ?? [],
  monthlyBudgetCNY: over.monthlyBudgetCNY ?? 400,
  destinationCountry: over.destinationCountry ?? "CN",
});

describe("computeNutritionDiffs", () => {
  it("relative to row mean: 42% vs 36% �� ��7.7% (vs mean 39%)", () => {
    const a = mkProduct({ id: "blue-buffalo", nutrition: { protein: 42, fat: 20, fiber: 4, moisture: 10, ash: 8, calories: 4040 } });
    const b = mkProduct({ id: "acana", nutrition: { protein: 36, fat: 20, fiber: 3, moisture: 12, ash: 7.5, calories: 4050 } });
    const diffs = computeNutritionDiffs([a, b]);
    const protein = diffs.find((d) => d.metric === "protein")!;
    expect(protein.values[0].value).toBe(42);
    expect(protein.values[1].value).toBe(36);
    // ƫ���ֵ 39% = (42-39)/39 �� 7.69%
    expect(protein.values[0].deviationPct).toBe(7.7);
    expect(protein.values[1].deviationPct).toBe(-7.7);
  });

  it("symmetric deviation: avg always 0", () => {
    const a = mkProduct({ id: "a", nutrition: { protein: 50, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 } });
    const b = mkProduct({ id: "b", nutrition: { protein: 30, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 } });
    const diffs = computeNutritionDiffs([a, b]);
    const protein = diffs.find((d) => d.metric === "protein")!;
    // ƫ��ֵ���ܺͱ�ȻΪ 0����Ϊ��׼ = ��ֵ��
    expect(protein.values[0].deviationPct + protein.values[1].deviationPct).toBeCloseTo(0, 1);
  });

  it("all same values �� 0 deviation", () => {
    const a = mkProduct({ id: "a" });
    const b = mkProduct({ id: "b" });
    const diffs = computeNutritionDiffs([a, b]);
    for (const d of diffs) {
      for (const v of d.values) {
        expect(v.deviationPct).toBe(0);
      }
    }
  });

  it("zero avg �� 0 deviation (avoid divide by zero)", () => {
    const a = mkProduct({ id: "a", nutrition: { protein: 0, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 } });
    const b = mkProduct({ id: "b", nutrition: { protein: 0, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 } });
    const diffs = computeNutritionDiffs([a, b]);
    for (const d of diffs) {
      for (const v of d.values) {
        expect(v.deviationPct).toBe(0);
      }
    }
  });

  it("3 products: deviation sum still 0 per row", () => {
    const a = mkProduct({ id: "a", nutrition: { protein: 20, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 } });
    const b = mkProduct({ id: "b", nutrition: { protein: 30, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 } });
    const c = mkProduct({ id: "c", nutrition: { protein: 40, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 } });
    const diffs = computeNutritionDiffs([a, b, c]);
    const protein = diffs.find((d) => d.metric === "protein")!;
    // a=20 vs avg 30 �� -33.3%; b=30 �� 0%; c=40 �� +33.3%
    expect(protein.values[0].deviationPct).toBe(-33.3);
    expect(protein.values[1].deviationPct).toBe(0);
    expect(protein.values[2].deviationPct).toBe(33.3);
  });
});

describe("isSignificantDeviation", () => {
  it.each([
    ["protein", 14, false],
    ["protein", 15, false],
    ["protein", 16, true],
    ["fat", 20, true],
    ["fiber", 25, true],
    ["calories", 5, false],
  ])("metric=%s, deviation=%s �� significant=%s", (metric, dev, expected) => {
    expect(isSignificantDeviation(metric as any, dev)).toBe(expected);
  });
});

describe("computeAllergenMatrix", () => {
  it("���г������ԭ", () => {
    const a = mkProduct({ id: "a", allergens: ["chicken", "rice"] });
    const b = mkProduct({ id: "b", allergens: ["beef"] });
    const pet = mkPet({ knownAllergens: ["chicken"] });
    const m = computeAllergenMatrix([a, b], pet);
    expect(m[0].petAllergensHit).toEqual(["chicken"]);
    expect(m[1].petAllergensHit).toEqual([]);
  });

  it("���д�Сд�����", () => {
    const a = mkProduct({ id: "a", allergens: ["CHICKEN"] });
    const pet = mkPet({ knownAllergens: ["chicken"] });
    const m = computeAllergenMatrix([a], pet);
    expect(m[0].petAllergensHit).toEqual(["CHICKEN"]);
  });
});

describe("scoreProducts (0-100)", () => {
  it("�׶� / ���� / ���� / �۸� ���ֳ���", () => {
    const p = mkProduct({
      allergens: [],
      weightRange: { min: 3, max: 6, unit: "kg" },
      pricePerUnit: 200, // �۸� 200 / Ԥ�� 400 = 50% �� 20 ��
    });
    const pet = mkPet({ weightKg: 4, monthlyBudgetCNY: 400, knownAllergens: [] });
    const scores = scoreProducts([p], pet);
    // lifeStage 30 + weightRange 20 + allergen 30 + price 20 = 100
    expect(scores[0].total).toBe(100);
  });

  it("���� 2 ������ԭ �� allergen 0", () => {
    const p = mkProduct({ allergens: ["chicken", "rice"] });
    const pet = mkPet({ knownAllergens: ["chicken", "rice"] });
    const scores = scoreProducts([p], pet);
    expect(scores[0].allergen).toBe(0);
    expect(scores[0].reasons.some((r) => r.includes("chicken") || r.includes("rice"))).toBe(true);
  });

  it("�׶� 'all' �� 18 ��", () => {
    const p = mkProduct({ lifeStage: "all" });
    const pet = mkPet({ ageStage: "puppy" });
    const scores = scoreProducts([p], pet);
    expect(scores[0].lifeStage).toBe(18);
  });

  it("�׶β�ƥ�� �� 0 ��", () => {
    const p = mkProduct({ lifeStage: "adult" });
    const pet = mkPet({ ageStage: "puppy" });
    const scores = scoreProducts([p], pet);
    expect(scores[0].lifeStage).toBe(0);
  });

  it("�۸�Ԥ�� 1.5�� �� 0 ��", () => {
    const p = mkProduct({ pricePerUnit: 700 });
    const pet = mkPet({ monthlyBudgetCNY: 400 });
    const scores = scoreProducts([p], pet);
    expect(scores[0].price).toBe(0);
  });

  it("�� weightRange �� 12 ��", () => {
    const p = mkProduct();
    const pet = mkPet();
    const scores = scoreProducts([p], pet);
    expect(scores[0].weightRange).toBe(12);
  });

  it("����ƫ�� 5kg�� 10 ��", () => {
    const p = mkProduct({ weightRange: { min: 5, max: 10, unit: "kg" } });
    const pet = mkPet({ weightKg: 12 });
    const scores = scoreProducts([p], pet);
    expect(scores[0].weightRange).toBe(10);
  });

  it("����ƫ�� > 5kg �� 0 ��", () => {
    const p = mkProduct({ weightRange: { min: 5, max: 10, unit: "kg" } });
    const pet = mkPet({ weightKg: 20 });
    const scores = scoreProducts([p], pet);
    expect(scores[0].weightRange).toBe(0);
  });
});

describe("defaultVerdict", () => {
  it("�÷ָ�������λ", () => {
    const a = mkProduct({ id: "a", allergens: ["chicken"] });
    const b = mkProduct({ id: "b" });
    const pet = mkPet({ knownAllergens: ["chicken"] });
    const scores = scoreProducts([a, b], pet);
    const v = defaultVerdict(scores);
    expect(v.ranking[0]).toBe("b");
    expect(v.ranking[1]).toBe("a");
  });
});

describe("buildCompareResponse", () => {
  it("������װ", () => {
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

  it("���� llmPart �� source = llm", () => {
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

  it("user-reported �����ع飺Blue Buffalo +7.7% / Acana -7.7% (����)", () => {
    const blue = mkProduct({
      id: "blue-buffalo",
      nutrition: { protein: 42, fat: 20, fiber: 4, moisture: 10, ash: 8, calories: 4040 },
    });
    const acana = mkProduct({
      id: "acana",
      nutrition: { protein: 36, fat: 20, fiber: 3, moisture: 12, ash: 7.5, calories: 4050 },
    });
    const pet = mkPet();
    const resp = buildCompareResponse(pet, [blue, acana]);
    const protein = resp.nutritionDiffs.find((d) => d.metric === "protein")!;
    expect(protein.values[0].deviationPct).toBe(7.7);
    expect(protein.values[1].deviationPct).toBe(-7.7);
    // ��֤�㷨˵������Ծ�ֵ��39%����������ԶԷ�
    // �û�ֱ��������Ϊ 42 vs 36 = +16.7%����ʵ������Ծ�ֵ
  });
});
