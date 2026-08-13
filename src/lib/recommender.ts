/**
 * Rule-based 推荐兜底（无 LLM 也能跑）
 * - 过滤: 物种、阶段、过敏原、月预算
 * - 评分: 阶段匹配 40 + 无过敏命中 40 + 跨境可售 10 + 价格 10
 * - 返回 top N，按 score 降序
 */

import type { Product, PetInfo, Recommendation } from "@/types";

export type RecommendOpts = {
  topN?: number;
  strictAllergen?: boolean; // 严格模式: 命中过敏原直接剔除
};

export function recommendByRules(
  pet: PetInfo,
  products: Product[],
  opts: RecommendOpts = {}
): { recommendations: Recommendation[]; summary: string } {
  const topN = opts.topN ?? 3;
  const strict = opts.strictAllergen ?? true;

  const allergensLower = pet.knownAllergens.map((a) => a.toLowerCase());

  // 1. 过滤
  const filtered = products.filter((p) => {
    if (p.species !== pet.species) return false;
    // 阶段: 商品阶段为 all 视为兼容；其他需与宠物阶段一致
    if (p.lifeStage !== "all" && p.lifeStage !== pet.ageStage) return false;
    // 过敏原严格剔除
    if (strict && p.allergens.some((a) => allergensLower.includes(a.toLowerCase()))) return false;
    // 预算: 单包价格 ≤ 月预算（粗略，允许偶尔超 50%）
    const monthlyAllowance = pet.monthlyBudgetCNY;
    if (p.pricePerUnit > monthlyAllowance * 1.5) return false;
    return true;
  });

  // 2. 评分
  const scored = filtered.map((p) => {
    let score = 0;
    const reasons: string[] = [];

    // 阶段 40
    if (p.lifeStage === pet.ageStage) {
      score += 40;
      reasons.push(`阶段匹配（${pet.ageStage}）`);
    } else if (p.lifeStage === "all") {
      score += 25;
      reasons.push("全阶段通用");
    }

    // 无过敏 40
    const hits = p.allergens.filter((a) => allergensLower.includes(a.toLowerCase()));
    if (hits.length === 0) {
      score += 40;
      reasons.push("无已知过敏原");
    } else {
      score += Math.max(0, 40 - hits.length * 20);
      reasons.push(`过敏命中 ${hits.length} 项`);
    }

    // 跨境 10
    if (p.crossBorderAvailable) {
      score += 10;
      reasons.push("支持跨境");
    }

    // 价格 10
    const ratio = p.pricePerUnit / pet.monthlyBudgetCNY;
    if (ratio <= 0.5) {
      score += 10;
      reasons.push("价格友好");
    } else if (ratio <= 1.0) {
      score += 5;
    }

    return { product: p, score, reason: reasons.join("；") };
  });

  // 3. 排序 + 取 topN
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topN);

  const recommendations: Recommendation[] = top.map((s, i) => ({
    productId: s.product.id,
    rank: i + 1,
    score: s.score,
    reason: s.reason || "符合过滤条件",
  }));

  // 4. summary
  const summary =
    top.length === 0
      ? "当前条件下未找到匹配商品，请放宽过滤（如减少过敏原 / 提高预算）。"
      : `基于${pet.species === "cat" ? "猫" : "狗"}/${pet.ageStage}阶段与过敏信息，从 ${filtered.length} 款候选中筛出 top ${top.length}。`;

  return { recommendations, summary };
}
