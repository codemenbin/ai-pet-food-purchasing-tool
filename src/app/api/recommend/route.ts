/**
 * POST /api/recommend
 * body: PetInfo
 * returns: RecommendResponse
 */

import { NextResponse } from "next/server";
import { PetInfoSchema, RecommendResponseSchema } from "@/types";
import { callLLM, isMockMode } from "@/lib/llm";
import { buildRecommendPrompt } from "@/lib/prompts";
import { recommendByRules } from "@/lib/recommender";
import { fetchProducts } from "@/lib/scraper";
import type { RecommendResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 反引号常量：用 String.fromCharCode 构造避免在源码里出现反引号触发模板字符串问题
const BT = String.fromCharCode(96);

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = PetInfoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pet = parsed.data;

  // 1) 拉取商品池（三层回退：live → cache → mock）
  const fetched = await fetchProducts();
  // 2) 按物种严格预过滤，避免 prompt 里混入异物种 ID 引起 LLM/mock 误判
  const candidates = fetched.products.filter((p) => p.species === pet.species);

  if (candidates.length === 0) {
    const resp: RecommendResponse = {
      recommendations: [],
      summary: "数据源 " + fetched.source + " 中暂无 " + (pet.species === "cat" ? "猫" : "狗") + " 主粮，请稍后再试。",
      source: "rule",
    };
    return NextResponse.json(resp);
  }

  try {
    const prompt = buildRecommendPrompt(pet, candidates);
    const raw = await callLLM(prompt);

    // 容忍 markdown code fence：用反引号常量拼接正则
    const fenceOpen = new RegExp("^" + BT + BT + BT + "json\\s*", "i");
    const fenceClose = new RegExp(BT + BT + BT + "\\s*$");
    const cleaned = raw.replace(fenceOpen, "").replace(fenceClose, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonStr = jsonStart >= 0 ? cleaned.slice(jsonStart) : cleaned;
    const obj = JSON.parse(jsonStr);
    const result = RecommendResponseSchema.safeParse({
      ...obj,
      source: isMockMode() ? "mock" : "llm",
    });

    if (!result.success) {
      throw new Error("LLM 输出不符合 schema: " + result.error.message);
    }

    // 二次校验：返回的 productId 必须存在于候选池
    const ids = new Set(candidates.map((c) => c.id));
    const safe = {
      ...result.data,
      recommendations: result.data.recommendations.filter((r) => ids.has(r.productId)),
    };
    return NextResponse.json(safe);
  } catch (err) {
    const fallback = recommendByRules(pet, candidates, { topN: 3 });
    const resp: RecommendResponse = {
      ...fallback,
      source: "rule",
    };
    return NextResponse.json(resp);
  }
}
