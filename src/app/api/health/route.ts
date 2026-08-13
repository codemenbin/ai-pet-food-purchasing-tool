/**
 * GET /api/health
 * 返回 LLM 配置状态（不暴露真实 Key）
 *  - mock     是否走 mock 模式
 *  - hasKey   是否配置了 LLM_API_KEY
 *  - baseURL  端点 host + 路径前 16 字符
 *  - model    模型名
 *  - lastError 上次客户端初始化抛错的简短描述
 */

import { NextResponse } from "next/server";
import { getLLMStatus } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const status = getLLMStatus();
  return NextResponse.json(status);
}
