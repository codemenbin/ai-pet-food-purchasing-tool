/**
 * Prompt 模板
 * - 所有 prompt 都遵循"少而精"原则
 * - 强约束 JSON Schema 输出，便于解析
 */

import type { PetInfo, Product } from "@/types";

/**
 * 个性化推荐 prompt
 */
export function buildRecommendPrompt(pet: PetInfo, candidates: Product[]): string {
  const candidateJson = JSON.stringify(
    candidates.map((p) => ({
      id: p.id,
      brand: p.brand,
      name: p.name,
      lifeStage: p.lifeStage,
      pricePerUnit: p.pricePerUnit,
      crossBorderAvailable: p.crossBorderAvailable,
      allergens: p.allergens,
      weightRange: p.weightRange,
    })),
    null,
    2
  );

  return `你是一名宠物营养师。基于下面宠物信息与候选商品，输出 JSON 推荐。

【宠物信息】
- 物种: ${pet.species === "cat" ? "猫" : "狗"}
- 品种: ${pet.breed}
- 阶段: ${pet.ageStage}
- 体重: ${pet.weightKg} kg
- 已知过敏: ${pet.knownAllergens.join(", ") || "无"}
- 月预算: ¥${pet.monthlyBudgetCNY}
- 跨境目的地: ${pet.destinationCountry}

【候选商品】
${candidateJson}

【输出要求】
严格 JSON（无 markdown、无注释）：
{
  "recommendations": [
    { "productId": "string", "rank": 1, "score": 0~100, "reason": "≤40 字" }
  ],
  "summary": "≤80 字摘要"
}
限制: 3-5 条推荐，按 score 降序；reason 必须解释为什么匹配此宠物。`;
}

/**
 * 配料表对比 prompt
 */
export function buildComparePrompt(
  pet: PetInfo,
  products: Product[],
  nutritionDiffs: unknown,
  scores: unknown
): string {
  const ids = products.map((p) => p.id).join(",");
  const productIds = `productIds=${ids}`;
  const productsJson = JSON.stringify(
    products.map((p) => ({
      id: p.id,
      brand: p.brand,
      name: p.name,
      species: p.species,
      lifeStage: p.lifeStage,
      pricePerUnit: p.pricePerUnit,
      crossBorderAvailable: p.crossBorderAvailable,
      allergens: p.allergens,
    })),
    null,
    2
  );

  return `你是一名宠物营养师。基于宠物信息、商品列表、营养差异、适配度评分，给出对比裁决。

${productIds}

【宠物信息】
- 物种: ${pet.species === "cat" ? "猫" : "狗"}
- 阶段: ${pet.ageStage}
- 体重: ${pet.weightKg} kg
- 已知过敏: ${pet.knownAllergens.join(", ") || "无"}

【商品】
${productsJson}

【营养差异（已计算）】
${JSON.stringify(nutritionDiffs)}

【适配度评分（已计算）】
${JSON.stringify(scores)}

【输出要求】
严格 JSON（无 markdown、无注释）：
{
  "ranking": ["productId1", "productId2", "productId3"],
  "verdict": "≤120 字的裁决，强调排序理由与过敏命中"
}`;
}
