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
import productsData from "@/data/products.json";
import type { Product, RecommendResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const products = productsData as Product[];

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

  try {
    const prompt = buildRecommendPrompt(pet, products);
    const raw = await callLLM(prompt);

    // 尝试解析 LLM 返回
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonStr = jsonStart >= 0 ? cleaned.slice(jsonStart) : cleaned;
    const obj = JSON.parse(jsonStr);
    const result = RecommendResponseSchema.safeParse({ ...obj, source: isMockMode() ? "mock" : "llm" });

    if (!result.success) {
      throw new Error(`LLM 输出不符合 schema: ${result.error.message}`);
    }

    const resp: RecommendResponse = result.data;
    return NextResponse.json(resp);
  } catch (err) {
    // 回退到 rule-based
    const fallback = recommendByRules(pet, products, { topN: 3 });
    const resp: RecommendResponse = {
      ...fallback,
      source: "rule",
    };
    return NextResponse.json(resp);
  }
}
