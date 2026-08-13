import { z } from "zod";

// ============================================================
// 枚举与基础类型
// ============================================================

export const SpeciesSchema = z.enum(["cat", "dog"]);
export type Species = z.infer<typeof SpeciesSchema>;

export const LifeStageSchema = z.enum(["puppy", "adult", "senior", "all"]);
export type LifeStage = z.infer<typeof LifeStageSchema>;

export const WeightUnitSchema = z.enum(["kg", "g"]);
export type WeightUnit = z.infer<typeof WeightUnitSchema>;

// ============================================================
// 商品 Product
// ============================================================

/**
 * 数字预处理：负数/null/NaN/越界 → 0
 * 配合 schema 容忍 LLM 的 "-1 / null / unknown" 标记
 */
function cleanNumber(v: unknown, max: number = 10000): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return Math.min(v, max);
}
function cleanPositive(v: unknown, fallback: number = 1, max: number = 100000): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(v, max);
}
function cleanClamped(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export const NutritionSchema = z.object({
  protein: z.preprocess((v) => cleanNumber(v, 100), z.number().min(0).max(100)),
  fat: z.preprocess((v) => cleanNumber(v, 100), z.number().min(0).max(100)),
  fiber: z.preprocess((v) => cleanNumber(v, 100), z.number().min(0).max(100)),
  moisture: z.preprocess((v) => cleanNumber(v, 100), z.number().min(0).max(100)),
  ash: z.preprocess((v) => cleanNumber(v, 100), z.number().min(0).max(100)),
  calories: z.preprocess((v) => cleanNumber(v, 10000), z.number().min(0).max(10000)),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

export const AdditivesSchema = z.object({
  vitamins: z.array(z.string()).optional(),
  minerals: z.array(z.string()).optional(),
  preservatives: z.array(z.string()).optional(),
  other: z.array(z.string()).optional(),
});
export type Additives = z.infer<typeof AdditivesSchema>;

export const WeightRangeSchema = z.object({
  min: z.preprocess((v) => cleanNumber(v, 1000), z.number().min(0).max(1000)),
  max: z.preprocess((v) => cleanNumber(v, 1000), z.number().min(0).max(1000)),
  unit: WeightUnitSchema,
});
export type WeightRange = z.infer<typeof WeightRangeSchema>;

export const ProductSchema = z.object({
  id: z.string().min(1),
  brand: z.string().min(1),
  name: z.string().min(1),
  species: SpeciesSchema,
  lifeStage: LifeStageSchema,
  packageSize: z.object({
    value: z.preprocess((v) => cleanPositive(v, 1, 1000), z.number().positive().max(1000)),
    unit: WeightUnitSchema,
  }),
  pricePerUnit: z.preprocess((v) => cleanPositive(v, 0, 100000), z.number().nonnegative().max(100000)),
  crossBorderAvailable: z.boolean(),
  origin: z.string().min(1),
  ingredients: z.array(z.string()).min(1),
  nutrition: NutritionSchema,
  additives: AdditivesSchema,
  allergens: z.array(z.string()),
  weightRange: WeightRangeSchema.optional(),
  notes: z.string().optional(),
});
export type Product = z.infer<typeof ProductSchema>;

// ============================================================
// 用户添加的商品 UserProduct
// - 来源：用户手动添加 / 图片 OCR / LLM 推断
// - aiConfidence: 0-1，仅 source="ai" 时有意义
// - source: "user" 表示纯手动；"ai" 表示 LLM 解析/推断
// ============================================================

export const UserProductMetaSchema = z.object({
  source: z.enum(["user", "ai"]),
aiConfidence: z.preprocess((v) => cleanClamped(v, 0, 1, 0), z.number().min(0).max(1).optional()),
  addedAt: z.number().int(),
  imageDataUrl: z.string().optional(), // 仅 localStorage 中保留；不参与 API 响应
});
export type UserProductMeta = z.infer<typeof UserProductMetaSchema>;

export const UserProductSchema = ProductSchema.extend({
  meta: UserProductMetaSchema,
});
export type UserProduct = z.infer<typeof UserProductSchema>;

// 推荐/对比 API 接受的统一商品类型（builtin + user）
export const AnyProductSchema = z.union([ProductSchema, UserProductSchema]);
export type AnyProduct = z.infer<typeof AnyProductSchema>;


// ============================================================
// 宠物信息 PetInfo
// - ageStage: 阶段枚举，用于商品粗粒度匹配
// - ageMonths: 实际月龄，用于细粒度展示与 LLM 上下文
// ============================================================

export const PetInfoSchema = z.object({
  species: SpeciesSchema,
  breed: z.string().min(1).max(80),
  ageStage: LifeStageSchema,
  ageMonths: z.number().int().min(0).max(360).default(48),
  weightKg: z.number().positive().max(200),
  knownAllergens: z.array(z.string()).default([]),
  monthlyBudgetCNY: z.number().positive().max(100000),
  destinationCountry: z.string().min(1).max(40),
});
export type PetInfo = z.infer<typeof PetInfoSchema>;

// ============================================================
// 个性化推荐 Recommendation
// ============================================================

export const RecommendationSchema = z.object({
  productId: z.string(),
  rank: z.number().int().min(1).max(10),
  score: z.number().min(0).max(100),
  reason: z.string().min(1).max(200),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const RecommendResponseSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(1).max(5),
  summary: z.string().min(1).max(500),
  source: z.enum(["llm", "rule", "mock"]),
});
export type RecommendResponse = z.infer<typeof RecommendResponseSchema>;

// 候选商品来源标签（前端透明展示数据出处）
export const CandidateSourceSchema = z.enum(["builtin", "user", "ai"]);
export type CandidateSource = z.infer<typeof CandidateSourceSchema>;

export const CandidateProductSchema = z.object({
  product: ProductSchema,
  source: CandidateSourceSchema,
aiConfidence: z.preprocess((v) => cleanClamped(v, 0, 1, 0), z.number().min(0).max(1).optional()),
});
export type CandidateProduct = z.infer<typeof CandidateProductSchema>;


// ============================================================
// 配料表对比 Comparison
// ============================================================

export const NutritionDiffSchema = z.object({
  metric: z.enum(["protein", "fat", "fiber", "moisture", "ash", "calories"]),
  values: z.array(
    z.object({
      productId: z.string(),
      value: z.number(),
      deviationPct: z.number(),
    })
  ),
});
export type NutritionDiff = z.infer<typeof NutritionDiffSchema>;

export const AllergenMatrixSchema = z.array(
  z.object({
    productId: z.string(),
    allergens: z.array(z.string()),
    petAllergensHit: z.array(z.string()),
  })
);
export type AllergenMatrix = z.infer<typeof AllergenMatrixSchema>;

export const ScoreBreakdownSchema = z.object({
  productId: z.string(),
  total: z.number().min(0).max(100),
  lifeStage: z.number().min(0).max(30),
  weightRange: z.number().min(0).max(20),
  allergen: z.number().min(0).max(30),
  price: z.number().min(0).max(20),
  reasons: z.array(z.string()),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const CompareResponseSchema = z.object({
  // 用 refine 而不是 .length().or()，避免类型推断成元组联合
  productIds: z.array(z.string()).refine(
    (arr) => arr.length === 2 || arr.length === 3,
    { message: "productIds 必须是 2 或 3 个" }
  ),
  verdict: z.string().min(1).max(500),
  ranking: z.array(z.string()),
  nutritionDiffs: z.array(NutritionDiffSchema),
  allergenMatrix: AllergenMatrixSchema,
  scores: z.array(ScoreBreakdownSchema),
  source: z.enum(["llm", "rule", "mock"]),
});
export type CompareResponse = z.infer<typeof CompareResponseSchema>;

