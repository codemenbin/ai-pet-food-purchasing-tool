/**
 * LLM 客户端
 * - DEMO_MODE / LLM_MOCK 开启时短路到本地 mock
 * - 否则按 OpenAI 兼容协议调用真实模型
 *
 * 环境变量:
 *   LLM_BASE_URL  e.g. https://api.example.com/v1
 *   LLM_API_KEY   sk-xxx
 *   LLM_MODEL     e.g. MiniMax-M3
 *   DEMO_MODE=1   强制 mock（覆盖 LLM_MOCK）
 *   LLM_MOCK=1    仅 mock LLM 调用
 */

import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  temperature?: number;
  maxTokens?: number;
  jsonSchema?: Record<string, unknown>; // 用于约束结构化输出
};

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  if (!apiKey) {
    throw new Error("LLM_API_KEY 未配置。请在 .env.local 设置，或启用 DEMO_MODE=1 / LLM_MOCK=1。");
  }
  cachedClient = new OpenAI({ apiKey, baseURL });
  return cachedClient;
}

export function isMockMode(): boolean {
  return process.env.DEMO_MODE === "1" || process.env.LLM_MOCK === "1";
}

/**
 * 调用大模型，返回纯文本响应。
 * mock 模式下委托给 getMockResponse（按 prompt 关键词分支）。
 */
export async function callLLM(
  prompt: string,
  opts: LLMOptions = {}
): Promise<string> {
  if (isMockMode()) {
    const { getMockResponse } = await import("./llm.mock");
    return getMockResponse(prompt, opts);
  }

  const client = getClient();
  const model = process.env.LLM_MODEL || "MiniMax-M3";

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 800,
      // 注意: jsonSchema 透传依赖具体 provider；此处仅做约定，不强求所有平台都支持
      ...(opts.jsonSchema
        ? { response_format: { type: "json_schema", json_schema: opts.jsonSchema } as any }
        : {}),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM 返回为空");
    }
    return content;
  } catch (err) {
    // 错误脱敏，不泄漏 Key
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`LLM 调用失败: ${msg.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***")}`);
  }
}

/**
 * 重置缓存客户端（仅供测试使用）
 */
export function __resetClient(): void {
  cachedClient = null;
}
