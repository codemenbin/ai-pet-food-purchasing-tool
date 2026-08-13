/**
 * POST /api/compare
 * body: { productIds: string[2-3], pet: PetInfo, userProducts?: UserProduct[] }
 * returns: CompareResponse
 *
 * 对比候选 = 内置商品库 + 客户端用户商品
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CompareResponseSchema, PetInfoSchema, UserProductSchema, type Product } from "@/types";
import { callLLM, isMockMode } from "@/lib/llm";
import { buildComparePrompt } from "@/lib/prompts";
import {
  buildCompareResponse,
  computeNutritionDiffs,
  scoreProducts,
} from "@/lib/comparator";
import { fetchProducts } from "@/lib/scraper";
import type { CompareResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BT = String.fromCharCode(96);

const BodySchema = z.object({
  productIds: z.array(z.string().min(1)).min(2).max(3),
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

  const { productIds, pet } = parsed.data;
  const userProducts = parsed.data.userProducts ?? [];

  const fetched = await fetchProducts();
  const builtin: Product[] = fetched.products;
  const userAsProduct: Product[] = userProducts.map((p) => {
    const { meta: _meta, ...rest } = p;
    return rest;
  });
  const allProducts: Product[] = builtin.concat(userAsProduct);

  const selectedProducts = allProducts.filter((p) => productIds.includes(p.id));
  if (selectedProducts.length !== productIds.length) {
    return NextResponse.json(
      {
        error: "部分 productId 不存在",
        missing: productIds.filter((id) => !allProducts.some((p) => p.id === id)),
      },
      { status: 400 }
    );
  }

  const species = new Set(selectedProducts.map((p) => p.species));
  if (species.size > 1) {
    return NextResponse.json(
      { error: "对比的商品必须属于同一物种" },
      { status: 400 }
    );
  }
  if (!selectedProducts.some((p) => p.species === pet.species)) {
    return NextResponse.json(
      { error: "商品物种(" + [...species].join("/") + ") 与宠物物种(" + pet.species + ") 不匹配" },
      { status: 400 }
    );
  }

  const nutritionDiffs = computeNutritionDiffs(selectedProducts);
  const scores = scoreProducts(selectedProducts, pet);

  let llmPart: { ranking?: string[]; verdict?: string } | undefined;
  try {
    const prompt = buildComparePrompt(pet, selectedProducts, nutritionDiffs, scores);
    const raw = await callLLM(prompt);
    const fenceOpen = new RegExp("^" + BT + BT + BT + "json\\s*", "i");
    const fenceClose = new RegExp(BT + BT + BT + "\\s*$");
    const cleaned = raw.replace(fenceOpen, "").replace(fenceClose, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonStr = jsonStart >= 0 ? cleaned.slice(jsonStart) : cleaned;
    const obj = JSON.parse(jsonStr);
    if (typeof obj.verdict === "string") llmPart = { verdict: obj.verdict };
    if (Array.isArray(obj.ranking))
      llmPart = {
        ...llmPart,
        ranking: (obj.ranking as unknown[]).filter((id: unknown): id is string => typeof id === "string"),
      };
  } catch {
    // 静默回退
  }

  const source: CompareResponse["source"] = llmPart ? (isMockMode() ? "mock" : "llm") : "rule";

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
