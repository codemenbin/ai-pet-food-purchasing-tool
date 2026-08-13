/**
 * LLM 客户端
 * - DEMO_MODE / LLM_MOCK 开启时短路到本地 mock
 * - 否则按 OpenAI 兼容协议调用真实模型
 * - 支持多模态（图片）通过 callLLMMessages
 *
 * 环境变量:
 *   LLM_BASE_URL  e.g. https://api.example.com/v1
 *   LLM_API_KEY   sk-xxx
 *   LLM_MODEL     e.g. MiniMax-M3
 *   DEMO_MODE=1   强制 mock（等同于 LLM_MOCK）
 *   LLM_MOCK=1    走 mock LLM 调用
 */

import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  temperature?: number;
  maxTokens?: number;
  jsonSchema?: Record<string, unknown>;
};

export type VisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type VisionMessage = {
  role: "system" | "user" | "assistant";
  content: string | VisionContent[];
};

let cachedClient: OpenAI | null = null;
let lastClientError: string | null = null;

function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  if (!apiKey) {
    const msg = "LLM_API_KEY 未配置。请在 .env.local 设置，或启用 DEMO_MODE=1 / LLM_MOCK=1。";
    lastClientError = msg;
    throw new Error(msg);
  }
  try {
    cachedClient = new OpenAI({ apiKey, baseURL });
    lastClientError = null;
  } catch (e) {
    const msg = "LLM 客户端初始化失败: " + (e instanceof Error ? e.message : String(e));
    lastClientError = msg;
    throw new Error(msg);
  }
  return cachedClient;
}

export function isMockMode(): boolean {
  return process.env.DEMO_MODE === "1" || process.env.LLM_MOCK === "1";
}

/**
 * 轻量健康检查：返回当前 LLM 配置状态（不暴露真实 Key）。
 * - mock: 是否走 mock
 * - hasKey: 是否配置了 LLM_API_KEY
 * - baseURL: 端点（截断显示）
 * - model: 模型名
 * - lastError: 上次 getClient 抛错的简短描述
 */
export function getLLMStatus() {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || "";
  const model = process.env.LLM_MODEL || "MiniMax-M3";
  const mock = isMockMode();
  const hasKey = !!apiKey && apiKey.length > 0;
  const safeBaseURL = baseURL
    ? baseURL.replace(/^(https?:\/\/[^/]+)(\/.*)?$/i, (_: string, host: string, path: string) => host + (path ? path.slice(0, 16) : ""))
    : "";
  return {
    mock,
    hasKey,
    baseURL: safeBaseURL,
    model,
    lastError: lastClientError,
  };
}

/**
 * 调用大模型，返回纯文本响应。
 * mock 模式下委派给 getMockResponse。
 */
export async function callLLM(
  prompt: string,
  opts: LLMOptions = {}
): Promise<string> {
  return callLLMMessages([{ role: "user", content: prompt }], opts);
}

/**
 * 多模态 LLM 调用（支持图片）。
 * - 纯文本 prompt 走 callLLM；
 * - 含图片时走 OpenAI vision 格式（image_url content part）。
 * - mock 模式下走 getMockResponse。
 *
 * 错误处理：任何异常（缺 Key、初始化失败、网络错、响应解析错）都抛出
 * 由调用方（parseProduct / recommender / comparator）决定是否 fallback。
 */
export async function callLLMMessages(
  messages: VisionMessage[],
  opts: LLMOptions = {}
): Promise<string> {
  if (isMockMode()) {
    const { getMockResponse } = await import("./llm.mock");
    const first = messages.find((m) => m.role === "user");
    const text = typeof first?.content === "string" ? first.content : "[vision mock]";
    return getMockResponse(text, opts);
  }

  let client: OpenAI;
  try {
    client = getClient();
  } catch (e) {
    // 初始化失败（缺 Key / 构造抛错）—— 上抛给调用方
    throw e instanceof Error ? e : new Error("LLM 客户端不可用");
  }

  const model = process.env.LLM_MODEL || "MiniMax-M3";

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 800,
      ...(opts.jsonSchema
        ? { response_format: { type: "json_schema", json_schema: opts.jsonSchema } as any }
        : {}),
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("LLM 返回为空");
    return content;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error("LLM 调用失败: " + msg.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***"));
  }
}

/**
 * 重置缓存客户端（仅供测试使用）。
 */
export function __resetClient(): void {
  cachedClient = null;
  lastClientError = null;
}
