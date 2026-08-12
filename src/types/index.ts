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

export const NutritionSchema = z.object({
  protein: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  fiber: z.number().min(0).max(100),
  moisture: z.number().min(0).max(100),
  ash: z.number().min(0).max(100),
  calories: z.number().min(0).max(10000), // kcal/kg
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
  min: z.number().min(0),
  max: z.number().min(0),
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
    value: z.number().positive(),
    unit: WeightUnitSchema,
  }),
  pricePerUnit: z.number().positive(),
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
// 宠物信息 PetInfo
// ============================================================

export const PetInfoSchema = z.object({
  species: SpeciesSchema,
  breed: z.string().min(1).max(80),
  ageStage: LifeStageSchema,
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
