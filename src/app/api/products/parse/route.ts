/**
 * POST /api/products/parse
 * body: { brand, name, species?, lifeStage?, ingredients?, imageDataUrl? }
 * returns: { product, confidence, warnings, source }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { parseProduct } from "@/lib/productParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  brand: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  species: z.enum(["cat", "dog"]).optional(),
  lifeStage: z.enum(["puppy", "adult", "senior", "all"]).optional(),
  ingredients: z.string().max(2000).optional(),
  imageDataUrl: z.string().startsWith("data:image/").max(5_000_000).optional(),
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

  const result = await parseProduct(parsed.data);
  return NextResponse.json(result);
}
