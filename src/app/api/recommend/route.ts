/**
 * POST /api/recommend
 * body: { pet: PetInfo, userProducts?: UserProduct[] }
 * returns: RecommendResponse
 *
 * 候选池 = 内置商品库 + 客户端 localStorage 中的用户商品
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { PetInfoSchema, RecommendResponseSchema, UserProductSchema, type Product } from "@/types";
import { callLLM, isMockMode } from "@/lib/llm";
import { buildRecommendPrompt } from "@/lib/prompts";
import { recommendByRules } from "@/lib/recommender";
import { fetchProducts } from "@/lib/scraper";
import type { RecommendResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BT = String.fromCharCode(96);

const BodySchema = z.object({
  pet: PetInfoSchema,
  userProducts: z.array(UserProductSchema).max(100).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pet = parsed.data.pet;
  const userProducts = parsed.data.userProducts ?? [];

  // 1) 拉取内置商品池（三层回退：live → cache → mock）
  const fetched = await fetchProducts();
  const builtin: Product[] = fetched.products;

  // 2) 合并用户商品（去掉 imageDataUrl 这种 local-only 字段）
  const userAsProduct: Product[] = userProducts.map((p) => {
    const { meta: _meta, ...rest } = p;
    return rest;
  });

  // 3) 按物种严格预过滤
  const allCandidates: Product[] = builtin.concat(userAsProduct);
  const candidates = allCandidates.filter((p) => p.species === pet.species);

  if (candidates.length === 0) {
    const resp: RecommendResponse = {
      recommendations: [],
      summary: "数据源 " + fetched.source + " 与用户库中均暂无 " + (pet.species === "cat" ? "猫" : "狗") + " 主粮，请添加商品后重试。",
      source: "rule",
    };
    return NextResponse.json(resp);
  }

  try {
    const prompt = buildRecommendPrompt(pet, candidates);
    const raw = await callLLM(prompt);

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

    // 二次校验：返回的 productId 必须存在于合并后的候选池
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
