/**
 * LLM mock: 基于 prompt 关键词的确定性响应
 * - 不依赖外部网络
 * - 返回结构化 JSON 字符串（与真实 LLM 行为对齐，方便 JSON.parse）
 * - 关键词检测顺序: 对比 > 推荐 > 兜底
 */

import type { LLMOptions } from "./llm";

// 简易 mock 商品池（与 products.json 子集对齐）
const MOCK_CAT_POOL = ["acana-cat-adult", "wellness-core-grain-free-cat", "pureluxe-grain-free-cat", "pro-plan-senior-cat", "ziwi-peak-air-dried"];
const MOCK_DOG_POOL = ["royal-canin-puppy", "hills-science-diet-senior", "orijen-puppy-dog", "taste-of-the-wild-salmon", "acana-freerunner-dog"];

function pickTop<T>(pool: T[], n: number): T[] {
  return pool.slice(0, n);
}

export function getMockResponse(prompt: string, _opts: LLMOptions): string {
  const isCompare = prompt.includes("对比") || prompt.includes("配料表对比") || prompt.includes("compare");
  const isRecommend = prompt.includes("推荐") || prompt.includes("recommend");

  if (isCompare) {
    // 解析 productIds（prompt 中包含产品 ID 列表 JSON）
    const idMatch = prompt.match(/productIds=([a-z0-9,\-]+)/i);
    const productIds = idMatch ? idMatch[1].split(",") : ["acana-cat-adult", "wellness-core-grain-free-cat"];
    const ranking = productIds.slice();
    const verdict =
      productIds.length === 2
        ? `【mock 裁决】综合适配度，A 略优于 B：若宠物敏感禽肉建议 B；若注重营养密度选 A。`
        : `【mock 裁决】三款排序：${ranking[0]} > ${ranking[1]} > ${ranking[2]}。建议结合过敏史与预算综合决策。`;
    return JSON.stringify({ ranking, verdict });
  }

  if (isRecommend) {
    const species = prompt.toLowerCase().includes("cat") || prompt.includes("猫") ? "cat" : "dog";
    const pool = species === "cat" ? MOCK_CAT_POOL : MOCK_DOG_POOL;
    const top = pickTop(pool, 3);
    const recommendations = top.map((id, i) => ({
      productId: id,
      rank: i + 1,
      score: 90 - i * 5,
      reason: `【mock】基于宠物阶段与过敏信息，${id} 匹配度高；建议优先试用小包装观察 7 天。`,
    }));
    const summary =
      "【mock】综合考虑物种、阶段、过敏与预算，推荐以上 3 款。可在『配料表对比』页面对两款做更细致比对。";
    return JSON.stringify({ recommendations, summary });
  }

  // 兜底
  return JSON.stringify({
    recommendations: [
      { productId: "acana-cat-adult", rank: 1, score: 85, reason: "【mock】兜底响应" },
    ],
    summary: "【mock】未识别任务类型，使用兜底推荐。",
  });
}
