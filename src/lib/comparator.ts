/**
 * 配料表对比 - 纯代码计算部分
 * - 营养差异: 6 维指标，阈值化差异高亮
 * - 添加剂: 按类别枚举
 * - 过敏原矩阵: 产品 × 宠物过敏原
 * - 适配度评分: lifeStage 30 + weightRange 20 + allergen 30 + price 20
 */

import type {
  AllergenMatrix,
  CompareResponse,
  NutritionDiff,
  PetInfo,
  Product,
  ScoreBreakdown,
} from "@/types";

const NUTRITION_KEYS = ["protein", "fat", "fiber", "moisture", "ash", "calories"] as const;
type NutritionKey = (typeof NUTRITION_KEYS)[number];

const NUTRITION_THRESHOLDS: Record<NutritionKey, number> = {
  protein: 15, // 偏差 > 15% 高亮
  fat: 15,
  fiber: 20,
  moisture: 10,
  ash: 15,
  calories: 10,
};

/**
 * 计算营养成分差异（百分比偏差）
 */
export function computeNutritionDiffs(products: Product[]): NutritionDiff[] {
  return NUTRITION_KEYS.map((metric) => {
    const values = products.map((p) => p.nutrition[metric]);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;

    return {
      metric,
      values: products.map((p, i) => {
        const v = values[i];
        const deviationPct = avg === 0 ? 0 : ((v - avg) / avg) * 100;
        return {
          productId: p.id,
          value: v,
          deviationPct: Math.round(deviationPct * 10) / 10,
        };
      }),
    };
  });
}

/**
 * 判断某偏差是否显著（用于 UI 高亮）
 */
export function isSignificantDeviation(metric: NutritionKey, deviationPct: number): boolean {
  return Math.abs(deviationPct) > NUTRITION_THRESHOLDS[metric];
}

/**
 * 过敏原矩阵
 */
export function computeAllergenMatrix(products: Product[], pet: PetInfo): AllergenMatrix {
  const petAllergensLower = pet.knownAllergens.map((a) => a.toLowerCase());
  return products.map((p) => {
    const hits = p.allergens.filter((a) => petAllergensLower.includes(a.toLowerCase()));
    return {
      productId: p.id,
      allergens: p.allergens,
      petAllergensHit: hits,
    };
  });
}

/**
 * 适配度评分（0-100）
 * - lifeStage 30: 商品阶段与宠物阶段一致 +30；all 阶段 +18
 * - weightRange 20: 商品适用体重区间覆盖宠物体重 +20；偏离一档 +10；不覆盖 0
 * - allergen 30: 无任何宠物过敏原命中 +30；命中 1 个 -15；命中 ≥2 个直接 0
 * - price 20: 单包价格 ≤ 月预算一半 +20；≤ 月预算 +10；超 50% 0
 */
export function scoreProducts(products: Product[], pet: PetInfo): ScoreBreakdown[] {
  return products.map((p) => {
    let lifeStage = 0;
    let weightRange = 0;
    let allergen = 0;
    let price = 0;
    const reasons: string[] = [];

    // lifeStage
    if (p.lifeStage === pet.ageStage) {
      lifeStage = 30;
      reasons.push(`阶段精准匹配（${pet.ageStage}）`);
    } else if (p.lifeStage === "all") {
      lifeStage = 18;
      reasons.push("全阶段通用");
    } else {
      reasons.push(`阶段不匹配（商品 ${p.lifeStage} vs 宠物 ${pet.ageStage}）`);
    }

    // weightRange
    if (p.weightRange) {
      const { min, max } = p.weightRange;
      if (pet.weightKg >= min && pet.weightKg <= max) {
        weightRange = 20;
        reasons.push(`体重覆盖（${min}~${max}kg）`);
      } else {
        const diff = pet.weightKg < min ? min - pet.weightKg : pet.weightKg - max;
        if (diff <= 5) {
          weightRange = 10;
          reasons.push("体重接近区间边缘");
        } else {
          reasons.push(`体重超出区间（${min}~${max}kg）`);
        }
      }
    } else {
      weightRange = 12; // 无适用区间声明，给中性分
      reasons.push("无体重区间声明");
    }

    // allergen
    const petAllergensLower = pet.knownAllergens.map((a) => a.toLowerCase());
    const hits = p.allergens.filter((a) => petAllergensLower.includes(a.toLowerCase()));
    if (hits.length === 0) {
      allergen = 30;
      reasons.push("无过敏原命中");
    } else if (hits.length === 1) {
      allergen = 15;
      reasons.push(`命中 1 项过敏原（${hits[0]}）`);
    } else {
      allergen = 0;
      reasons.push(`命中 ${hits.length} 项过敏原（${hits.join(", ")}）`);
    }

    // price
    const ratio = p.pricePerUnit / pet.monthlyBudgetCNY;
    if (ratio <= 0.5) {
      price = 20;
      reasons.push("价格友好");
    } else if (ratio <= 1.0) {
      price = 10;
      reasons.push("价格在预算内");
    } else {
      price = 0;
      reasons.push(`价格超预算（${Math.round(ratio * 100)}%）`);
    }

    return {
      productId: p.id,
      total: lifeStage + weightRange + allergen + price,
      lifeStage,
      weightRange,
      allergen,
      price,
      reasons,
    };
  });
}

/**
 * 计算默认裁决（mock/rule 模式用）
 */
export function defaultVerdict(scores: ScoreBreakdown[]): { ranking: string[]; verdict: string } {
  const sorted = [...scores].sort((a, b) => b.total - a.total);
  const ranking = sorted.map((s) => s.productId);
  const top = sorted[0];
  const verdict = top
    ? `【兜底裁决】综合评分：${top.productId} 得分最高（${top.total}/100）。建议结合宠物实测反应做最终决策。`
    : "【兜底裁决】当前无候选商品可比较。";
  return { ranking, verdict };
}

/**
 * 一站式：输入宠物 + 商品，输出完整结构化结果（不含 LLM 裁决）
 */
export function buildCompareResponse(
  pet: PetInfo,
  products: Product[],
  llmPart?: { ranking?: string[]; verdict?: string }
): CompareResponse {
  const productIds = products.map((p) => p.id);
  const nutritionDiffs = computeNutritionDiffs(products);
  const allergenMatrix = computeAllergenMatrix(products, pet);
  const scores = scoreProducts(products, pet);

  const fallback = defaultVerdict(scores);
  const ranking = llmPart?.ranking && llmPart.ranking.length === productIds.length
    ? llmPart.ranking
    : fallback.ranking;
  const verdict = llmPart?.verdict || fallback.verdict;

  return {
    productIds,
    verdict,
    ranking,
    nutritionDiffs,
    allergenMatrix,
    scores,
    source: llmPart ? "llm" : "rule",
  };
}
