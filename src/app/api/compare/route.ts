/**
 * POST /api/compare
 * body: { productIds: string[2-3], pet: PetInfo }
 * returns: CompareResponse
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CompareResponseSchema, PetInfoSchema } from "@/types";
import { callLLM, isMockMode } from "@/lib/llm";
import { buildComparePrompt } from "@/lib/prompts";
import {
  buildCompareResponse,
  computeNutritionDiffs,
  scoreProducts,
} from "@/lib/comparator";
import productsData from "@/data/products.json";
import type { CompareResponse, Product } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const products = productsData as Product[];

const BodySchema = z.object({
  productIds: z
    .array(z.string().min(1))
    .min(2)
    .max(3),
  pet: PetInfoSchema,
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

  const { productIds, pet } = parsed.data;

  // 校验 productIds 存在
  const selectedProducts = products.filter((p) => productIds.includes(p.id));
  if (selectedProducts.length !== productIds.length) {
    return NextResponse.json(
      { error: "部分 productId 不存在", missing: productIds.filter((id) => !products.some((p) => p.id === id)) },
      { status: 400 }
    );
  }

  // 物种必须一致
  const species = new Set(selectedProducts.map((p) => p.species));
  if (species.size > 1) {
    return NextResponse.json(
      { error: "对比的商品必须属于同一物种" },
      { status: 400 }
    );
  }
  if (!selectedProducts.some((p) => p.species === pet.species)) {
    return NextResponse.json(
      { error: `商品物种(${[...species].join("/")}) 与宠物物种(${pet.species}) 不匹配` },
      { status: 400 }
    );
  }

  // 计算结构化部分
  const nutritionDiffs = computeNutritionDiffs(selectedProducts);
  const scores = scoreProducts(selectedProducts, pet);

  // 尝试 LLM 裁决
  let llmPart: { ranking?: string[]; verdict?: string } | undefined;
  try {
    const prompt = buildComparePrompt(pet, selectedProducts, nutritionDiffs, scores);
    const raw = await callLLM(prompt);
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonStr = jsonStart >= 0 ? cleaned.slice(jsonStart) : cleaned;
    const obj = JSON.parse(jsonStr);
    if (typeof obj.verdict === "string") llmPart = { verdict: obj.verdict };
    if (Array.isArray(obj.ranking)) llmPart = { ...llmPart, ranking: obj.ranking.filter((id: unknown) => typeof id === "string") };
  } catch {
    // 静默回退
  }

  const source: CompareResponse["source"] = llmPart
    ? isMockMode()
      ? "mock"
      : "llm"
    : "rule";

  const response: CompareResponse = {
    ...buildCompareResponse(pet, selectedProducts, llmPart),
    source,
  };

  const validated = CompareResponseSchema.safeParse(response);
  if (!validated.success) {
    return NextResponse.json(
      { error: "对比结果校验失败", details: validated.error.flatten() },
      { status: 500 }
    );
  }

  return NextResponse.json(validated.data);
}
