/**
 * 商品信息解析
 * - 输入：品牌 + 名称 + 可选图片（data URL）+ 可选成分文本
 * - 输出：完整 Product 结构 + 置信度 + warnings
 * - 优先用 LLM（文本/视觉）；LLM 失败或 mock 模式下走 rule-based 默认值
 */

import { callLLMMessages, isMockMode, type VisionMessage } from "./llm";
import { ProductSchema, type Product } from "@/types";
import { z } from "zod";

export type ParseInput = {
  brand: string;
  name: string;
  species?: "cat" | "dog";
  lifeStage?: "puppy" | "adult" | "senior" | "all";
  ingredients?: string;
  imageDataUrl?: string;
};

export type ParseOutput = {
  product: Product;
  confidence: number;
  warnings: string[];
  source: "llm" | "rule" | "mock";
};

const ParseResultSchema = z.object({
  product: ProductSchema,
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
});

function detectSpecies(text: string): "cat" | "dog" {
  const t = text.toLowerCase();
  if (/(cat|kitten|feline)/.test(t)) return "cat";
  if (/(dog|puppy|canine)/.test(t)) return "dog";
  return "cat";
}

function detectLifeStage(text: string): "puppy" | "adult" | "senior" | "all" {
  const t = text.toLowerCase();
  if (/(puppy|kitten)/.test(t)) return "puppy";
  if (/(senior|mature)/.test(t)) return "senior";
  if (/(adult)/.test(t)) return "adult";
  return "all";
}

function ruleBasedProduct(input: ParseInput): Product {
  const species = input.species ?? detectSpecies(input.brand + " " + input.name);
  const lifeStage = input.lifeStage ?? detectLifeStage(input.brand + " " + input.name);
  const slug = (input.brand + "-" + input.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return {
    id: ("user-" + slug || "user-product") + "-" + Date.now().toString(36),
    brand: input.brand,
    name: input.name,
    species,
    lifeStage,
    packageSize: { value: 1, unit: "kg" },
    pricePerUnit: 0,
    crossBorderAvailable: false,
    origin: "用户添加",
    ingredients: input.ingredients
      ? input.ingredients.split(/[,,,]/).map((s) => s.trim()).filter(Boolean)
      : ["（未提供成分表）"],
    nutrition: { protein: 0, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 },
    additives: {},
    allergens: [],
    notes: "由用户手动添加（无 LLM 数据）",
  };
}

/**
 * 花括号配对提取（支持嵌套 + 字符串内的花括号）
 * - 找到第一个 { 后，跟踪引号状态，匹配到对应 } 结束
 * - 用于从 LLM 输出中可靠地提取 JSON
 */
/**
 * 脱掉 LLM 的"思考 / 推理"过程块。
 * 推理型模型（DeepSeek R1、Qwen3、GLM-Z1 等）会在 JSON 前输出
 *  <think>...</think>、<reasoning>...</reasoning>、<analysis>...</analysis>
 * 这些块不带 JSON，需要先去掉。
 */
function stripThinkingBlocks(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .trim();
}

function extractBalancedJson(raw: string): string | null {
  // 从第一个 { 开始，扫描到配对成功的 } —— 外层对象
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  // 截断：未闭合时尝试补一个 } 让宽松解析器尝试
  if (depth > 0) return raw.slice(start) + "}".repeat(depth);
  return null;
}

/**
 * 尝试尽力从 LLM 输出中提取 JSON，3 级降级：
 *  1. JSON.parse（完整 JSON）
 *  2. 去掉控制字符 + JSON.parse
 *  3. 模板截断拼贴：插入缺失的 }
 */
function safeParseJson(raw: string): unknown | null {
  // 0. 脱掉 <think> 等推理块（DeepSeek R1 / Qwen3 / GLM-Z1 等会先输出思考）
  const stripped = stripThinkingBlocks(raw);
  // 1. 平衡提取
  const balanced = extractBalancedJson(raw);
  if (!balanced) return null;
  try {
    return JSON.parse(balanced);
  } catch {}
  // 2. 去控制字符（LLM 偶发输出 \u0000 等不可见字符）
  const cleaned = balanced.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  try {
    return JSON.parse(cleaned);
  } catch {}
  // 3. 把 ]+ 或 }] 截断后补全
  try {
    return JSON.parse(cleaned + "}".repeat(3));
  } catch {}
  return null;
}

/**
 * 清洗 LLM 输出里的"未知"标记。
 * LLM 经常用 -1 / null / undefined / unknown / N/A 表示未知，但 schema 要求 min(0)。
 * 把所有这些都归一化为 0。
 */
const NUTRITION_KEYS = ["protein", "fat", "fiber", "moisture", "ash", "calories"] as const;
function sanitizeNutrition(n: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const obj = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
  for (const k of NUTRITION_KEYS) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = Math.min(v, k === "calories" ? 10000 : 100);
    } else {
      out[k] = 0;
    }
  }
  return out;
}

/**
 * 清洗 Product 整体：nutrition 修复 + 字符串字段兜底
 */
/**
 * 把任意值规整为正数（> 0），用于 schema 里的 z.number().positive() 字段
 *  - 负数 / 0 / null / undefined / NaN → 1（默认最小有效值）
 *  - 超过上限 → clamp
 */
function sanitizePositive(v: unknown, max: number = 100000, fallback: number = 1): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(v, max);
  }
  return fallback;
}

/**
 * 把任意值规整为非负数（>= 0），用于 schema 里的 z.number().min(0) 字段
 *  - 负数 / null / undefined / NaN → 0
 *  - 超过上限 → clamp
 */
function sanitizeNonNegative(v: unknown, max: number = 10000, fallback: number = 0): number {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.min(v, max);
  }
  return fallback;
}

/**
 * 清洗 Product 整体：所有数字字段 + 字符串字段兜底
 *  - nutrition.* 全部非负 (min 0)
 *  - weightRange.min / weightRange.max 全部非负 (min 0)
 *  - packageSize.value / pricePerUnit 全部正数 (positive)
 *  - 字符串字段 null/undefined → ""
 */
function sanitizeProduct(p: unknown): unknown {
  if (!p || typeof p !== "object") return p;
  const prod = p as Record<string, unknown>;

  // nutrition 全部非负
  if (prod.nutrition && typeof prod.nutrition === "object") {
    prod.nutrition = sanitizeNutrition(prod.nutrition);
  }

  // weightRange.min / max 全部非负
  if (prod.weightRange && typeof prod.weightRange === "object") {
    const wr = prod.weightRange as Record<string, unknown>;
    wr.min = sanitizeNonNegative(wr.min, 1000);
    wr.max = sanitizeNonNegative(wr.max, 1000, 0);
    // 确保 max >= min，否则校正
    if (typeof wr.min === "number" && typeof wr.max === "number" && wr.max < wr.min) {
      wr.max = wr.min;
    }
  }

  // packageSize.value 必须 positive
  if (prod.packageSize && typeof prod.packageSize === "object") {
    const ps = prod.packageSize as Record<string, unknown>;
    ps.value = sanitizePositive(ps.value, 1000, 1);
  }

  // pricePerUnit 必须 positive
  prod.pricePerUnit = sanitizePositive(prod.pricePerUnit, 100000, 0);

  // 字符串字段兜底：null/undefined → ""
  for (const k of ["brand", "name", "origin"]) {
    if (prod[k] === null || prod[k] === undefined) prod[k] = "";
  }

  // ingredients 数组兜底：非字符串过滤掉
  if (Array.isArray(prod.ingredients)) {
    prod.ingredients = prod.ingredients.filter((x: unknown) => typeof x === "string" && x.length > 0);
  }
  if (Array.isArray(prod.allergens)) {
    prod.allergens = prod.allergens.filter((x: unknown) => typeof x === "string" && x.length > 0);
  }
  // 通用数组字段清洗：任何 string[] 类型字段都过滤非字符串元素
  function cleanStringArray(v: unknown): string[] | undefined {
    if (v === undefined || v === null) return undefined;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  // additives 数组兜底
  if (prod.additives && typeof prod.additives === "object") {
    const add = prod.additives as Record<string, unknown>;
    for (const k of ["vitamins", "minerals", "preservatives", "other"]) {
      const cleaned = cleanStringArray(add[k]);
      if (cleaned && cleaned.length > 0) add[k] = cleaned;
      else delete add[k];
    }
  }

  return prod;
}

export async function parseProduct(input: ParseInput): Promise<ParseOutput> {
  // 快速通道：mock 模式直接走 rule-based（避免任何 LLM 调用）
  if (isMockMode()) {
    return {
      product: ruleBasedProduct(input),
      confidence: 0.3,
      warnings: ["演示模式：使用 rule-based 默认值"],
      source: "rule",
    };
  }

  const promptLines = [
    "你是宠物粮食行业的数据专家。基于以下信息推荐该商品的完整规格，输出严格 JSON。",
    "",
    "【商品基本信息】",
    "- 品牌: " + input.brand,
    "- 名称: " + input.name,
    "- 推测物种: " + (input.species ?? "未指定"),
    "- 推测阶段: " + (input.lifeStage ?? "未指定"),
  ];
  if (input.ingredients) {
    promptLines.push("- 用户提供的成分表: " + input.ingredients);
  }
  promptLines.push(
    "",
    "【输出要求】",
    "1. 仅输出合法 JSON（无 markdown / 注释 / 解释）。",
    "2. 顶层: { product, confidence (0-1), warnings (string[]) }。",
    "3. product 字段（严格匹配 ProductSchema）：id, brand, name, species (cat/dog), lifeStage (puppy/adult/senior/all), packageSize:{value,unit:kg/g}, pricePerUnit (CNY, 无数据填 0), crossBorderAvailable (bool), origin (string, 查不到填 未知), ingredients (string[]), nutrition:{protein%, fat%, fiber%, moisture%, ash%, calories (kcal/kg)}, additives:{vitamins?, minerals?, preservatives?, other?}, allergens (string[]), weightRange?:{min, max, unit:kg/g}, notes?:string",
    "4. 拿不准的字段填合理默认值并在 warnings 里说明。",
    "5. 营养成分若无可靠数据，给 0 并在 warnings 标注。",
    "6. id 格式: user-<brand>-<name>-<short hash>，全部小写、连字符。",
    "7. 关键：字符串内禁止出现未转义的双引号；使用 ASCII 双引号包裹键和值。",
    "8. 重要：所有数字字段（nutrition、packageSize.value、pricePerUnit 等）必须是正数；未知数据填 0；禁止填 -1、null、undefined、unknown、N/A。",
    "9. 重要：直接输出 JSON，**不要在前面输出 <think>...</think> 思考过程**、不要输出 reasoning 块、不要任何分析说明。",
  );
  const promptText = promptLines.join(String.fromCharCode(10));

  const messages: VisionMessage[] = input.imageDataUrl
    ? [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: input.imageDataUrl } },
          ],
        },
      ]
    : [{ role: "user", content: promptText }];

  try {
    // 增加 maxTokens 防止长 JSON 被截断；温度 0.2 保持稳定
    const raw = await callLLMMessages(messages, { temperature: 0.2, maxTokens: 2000 });

    // 1) 去掉 markdown code fence
    const fenceOpen = new RegExp("^" + String.fromCharCode(96, 96, 96) + "json\\s*", "i");
    const fenceClose = new RegExp(String.fromCharCode(96, 96, 96) + "\\s*$");
    const cleaned = raw.replace(fenceOpen, "").replace(fenceClose, "").trim();

    // 2) 花括号配对提取 + 宽松解析
    const obj = safeParseJson(cleaned);
    if (obj === null) {
      throw new Error("LLM 输出无法解析为 JSON（前 100 字符: " + cleaned.slice(0, 100) + "）");
    }

    // 3) 数据清洗：把 LLM 的 "-1 / null / unknown" 标记归一化为 0
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      if ("product" in o) {
        o.product = sanitizeProduct(o.product);
      }
      // 顶层 confidence：min(0).max(1)，负数/NaN/越界 → 0.3（默认值）
      if (typeof o.confidence !== "number" || !Number.isFinite(o.confidence) || o.confidence < 0 || o.confidence > 1) {
        o.confidence = 0.3;
      }
      // warnings 兜底：必须是 string[]
      if (!Array.isArray(o.warnings)) {
        o.warnings = [];
      } else {
        o.warnings = o.warnings.filter((x: unknown): x is string => typeof x === "string");
      }
    }

    const parsed = ParseResultSchema.safeParse(obj);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i: any) => ({ path: i.path.join("."), message: i.message, code: i.code }));
      throw new Error("LLM 输出不符合 schema: " + JSON.stringify(issues) + " | LLM 原始输出前 500 字符: " + raw.slice(0, 500));
    }
    return {
      product: parsed.data.product,
      confidence: parsed.data.confidence,
      warnings: parsed.data.warnings,
      source: "llm",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      product: ruleBasedProduct(input),
      confidence: 0.3,
      warnings: ["LLM 解析失败，使用 rule-based 默认值: " + msg.slice(0, 120)],
      source: "rule",
    };
  }
}