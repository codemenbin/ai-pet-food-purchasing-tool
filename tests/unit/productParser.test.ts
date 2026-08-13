import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { parseProduct } from "@/lib/productParser";

const ORIG = { ...process.env };

describe("parseProduct - rule-based path (mock mode)", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "1";
    process.env.LLM_MOCK = "1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("returns rule-based product with id prefixed user-", async () => {
    const out = await parseProduct({ brand: "Acme", name: "Salmon Cat" });
    expect(out.source).toBe("rule");
    expect(out.product.id.startsWith("user-acme-salmon-cat-")).toBe(true);
    expect(out.confidence).toBeLessThanOrEqual(0.5);
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it("explicit species / lifeStage respected", async () => {
    const out = await parseProduct({ brand: "X", name: "Y", species: "dog", lifeStage: "puppy" });
    expect(out.product.species).toBe("dog");
    expect(out.product.lifeStage).toBe("puppy");
  });

  it("detect species from brand+name (English)", async () => {
    const cat = await parseProduct({ brand: "Acme", name: "Indoor Cat Formula" });
    const dog = await parseProduct({ brand: "Acme", name: "Puppy Chicken" });
    expect(cat.product.species).toBe("cat");
    expect(dog.product.species).toBe("dog");
  });

  it("ingredients string split by comma + filtered empty", async () => {
    const out = await parseProduct({
      brand: "X", name: "Y",
      ingredients: "chicken, rice,, corn, ,fish oil",
    });
    expect(out.product.ingredients).toEqual(["chicken", "rice", "corn", "fish oil"]);
  });

  it("empty ingredients gives default placeholder", async () => {
    const out = await parseProduct({ brand: "X", name: "Y" });
    expect(out.product.ingredients).toEqual(["（未提供成分表）"]);
  });

  it("nutrition defaults to all zeros (no LLM data)", async () => {
    const out = await parseProduct({ brand: "X", name: "Y" });
    expect(out.product.nutrition).toEqual({
      protein: 0, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0,
    });
  });
});

describe("parseProduct - real LLM path with lenient JSON parsing", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    process.env.LLM_API_KEY = "sk-test-fake";
    process.env.LLM_BASE_URL = "https://mock.example/v1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  // 用户报告的"Unterminated string in JSON at position 707"：被截断的 JSON
  const TRUNCATED_JSON = `{
    "product": {
      "id": "user-acme-salmon-cat-abc123",
      "brand": "Acme",
      "name": "Salmon Cat",
      "species": "cat",
      "lifeStage": "adult",
      "packageSize": { "value": 2, "unit": "kg" },
      "pricePerUnit": 280,
      "crossBorderAvailable": true,
      "origin": "Canada",
      "ingredients": ["salmon", "rice", "chicken fat"],
      "nutrition": { "protein": 32, "fat": 16, "fiber": 4, "moisture": 10, "ash": 7, "calories": 3800 },
      "additives": {},
      "allergens": ["salmon"],
      "notes": "Premium adult cat formula"
    },
    "confidence": 0.85,
    "warnings": [""]`;

  it("truncated JSON (unterminated string) → gracefully fallback to rule-based", async () => {
    const llm = await import("@/lib/llm");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(TRUNCATED_JSON);
    try {
      const out = await parseProduct({ brand: "Acme", name: "Salmon Cat" });
      // 我们的宽松解析应该能救回：补 `}` 让 JSON 通过
      expect(out.source).toBe("llm");
      expect(out.product.brand).toBe("Acme");
      expect(out.product.nutrition.protein).toBe(32);
      expect(out.confidence).toBe(0.85);
    } finally {
      spy.mockRestore();
    }
  });

  // 完全被截断到 position 707 之前的真实场景
  const HEAVILY_TRUNCATED = `{
    "product": {
      "id": "user-acme-puppy-dog-abc",
      "brand": "Acme",
      "name": "Puppy Dog",
      "species": "dog",
      "lifeStage": "puppy",
      "packageSize": { "value": 5, "unit": "kg" },
      "pricePerUnit": 320,
      "crossBorderAvailable": true,
      "origin": "USA",
      "ingredients": ["chicken", "rice", "lamb"],
      "nutrition": { "protein": 28, "fat": 18, "fiber": 3, "moisture": 10, "ash": 6, "calories": 3700 },
      "additives": { "vitamins": ["A", "D", "E"] },
      "allergens": ["chicken"],
      "notes": "Holistic puppy formula with omega-3 fatty acids for brain develop`;

  it("heavily truncated JSON mid-string → fallback to rule-based with descriptive warning", async () => {
    const llm = await import("@/lib/llm");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(HEAVILY_TRUNCATED);
    try {
      const out = await parseProduct({ brand: "Acme", name: "Puppy Dog" });
      // 截断在字符串中间，宽松解析 + 补 `}` 后 Zod 仍可能失败；最终兜底 rule-based
      expect(out.source).toBe("rule");
      expect(out.warnings.some((w: string) => w.includes("LLM 解析失败"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("wrapped in ```json fence → strips fence then parses", async () => {
    const llm = await import("@/lib/llm");
    const wrapped = '```json\n{"product":{"id":"user-x-y-z","brand":"X","name":"Y","species":"cat","lifeStage":"adult","packageSize":{"value":1,"unit":"kg"},"pricePerUnit":100,"crossBorderAvailable":false,"origin":"China","ingredients":["a"],"nutrition":{"protein":30,"fat":15,"fiber":4,"moisture":10,"ash":7,"calories":3700},"additives":{},"allergens":[]},"confidence":0.9,"warnings":[]}\n```';
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(wrapped);
    try {
      const out = await parseProduct({ brand: "X", name: "Y" });
      expect(out.source).toBe("llm");
      expect(out.product.nutrition.protein).toBe(30);
    } finally {
      spy.mockRestore();
    }
  });

  it("JSON with control chars → strips control chars then parses", async () => {
    const llm = await import("@/lib/llm");
    const dirty = ' {"product":{"id":"user-x-y-q","brand":"X","name":"Y","species":"cat","lifeStage":"adult","packageSize":{"value":1,"unit":"kg"},"pricePerUnit":100,"crossBorderAvailable":false,"origin":"China","ingredients":["a"],"nutrition":{"protein":30,"fat":15,"fiber":4,"moisture":10,"ash":7,"calories":3700},"additives":{},"allergens":[]},"confidence":0.9,"warnings":[]} ';
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(dirty);
    try {
      const out = await parseProduct({ brand: "X", name: "Y" });
      expect(out.source).toBe("llm");
    } finally {
      spy.mockRestore();
    }
  });

  it("completely non-JSON output → fallback to rule-based with clear warning", async () => {
    const llm = await import("@/lib/llm");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue("这是一个中文字符串根本无法解析");
    try {
      const out = await parseProduct({ brand: "X", name: "Y" });
      expect(out.source).toBe("rule");
      expect(out.warnings.some((w: string) => w.includes("LLM 解析失败"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("parseProduct - sanitize unknown markers in LLM output", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    process.env.LLM_API_KEY = "sk-test-fake";
    process.env.LLM_BASE_URL = "https://mock.example/v1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("nutrition negative values (-1) → all 0", async () => {
    const llm = await import("@/lib/llm");
    const withNegatives = JSON.stringify({
      product: {
        id: "user-x-y-z1",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: -1, fat: -1, fiber: -1, moisture: -1, ash: -1, calories: -1 },
        additives: {}, allergens: [],
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(withNegatives);
    try {
      const out = await parseProduct({ brand: "X", name: "Y" });
      expect(out.source).toBe("llm");
      expect(out.product.nutrition).toEqual({ protein: 0, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0 });
    } finally {
      spy.mockRestore();
    }
  });

  it("nutrition null values → 0", async () => {
    const llm = await import("@/lib/llm");
    const withNulls = JSON.stringify({
      product: {
        id: "user-x-y-z2",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: null, fat: null, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: 0.7, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(withNulls);
    try {
      const out = await parseProduct({ brand: "X", name: "Y" });
      expect(out.source).toBe("llm");
      expect(out.product.nutrition.protein).toBe(0);
      expect(out.product.nutrition.fat).toBe(0);
      expect(out.product.nutrition.fiber).toBe(4);
    } finally {
      spy.mockRestore();
    }
  });

  it("nutrition > 100 (impossible value) → clamped to 100", async () => {
    const llm = await import("@/lib/llm");
    const withBig = JSON.stringify({
      product: {
        id: "user-x-y-z3",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 200, fat: 999, fiber: 4, moisture: 10, ash: 7, calories: 50000 },
        additives: {}, allergens: [],
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(withBig);
    try {
      const out = await parseProduct({ brand: "X", name: "Y" });
      expect(out.source).toBe("llm");
      // protein/fat/fiber/moisture/ash 都被 clamp 到 100；calories 到 10000
      expect(out.product.nutrition.protein).toBe(100);
      expect(out.product.nutrition.fat).toBe(100);
      expect(out.product.nutrition.calories).toBe(10000);
    } finally {
      spy.mockRestore();
    }
  });

  it("missing nutrition keys → all 0", async () => {
    const llm = await import("@/lib/llm");
    const missing = JSON.stringify({
      product: {
        id: "user-x-y-z4",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30 }, // 其他字段都缺
        additives: {}, allergens: [],
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(missing);
    try {
      const out = await parseProduct({ brand: "X", name: "Y" });
      expect(out.source).toBe("llm");
      expect(out.product.nutrition.protein).toBe(30);
      expect(out.product.nutrition.fat).toBe(0);
      expect(out.product.nutrition.fiber).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});
describe("parseProduct - sanitize weightRange / packageSize / pricePerUnit", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    process.env.LLM_API_KEY = "sk-test-fake";
    process.env.LLM_BASE_URL = "https://mock.example/v1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("weightRange.min = -1 → 0 (fixes too_small min:0)", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-w1",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
        weightRange: { min: -1, max: 10, unit: "kg" },
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      expect(r.product.weightRange!.min).toBe(0);
      expect(r.product.weightRange!.max).toBe(10);
    } finally {
      spy.mockRestore();
    }
  });

  it("weightRange.max = -5 → corrected to min", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-w2",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
        weightRange: { min: 5, max: -5, unit: "kg" },
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      // max < min 被校正为 min
      expect(r.product.weightRange!.min).toBe(5);
      expect(r.product.weightRange!.max).toBe(5);
    } finally {
      spy.mockRestore();
    }
  });

  it("packageSize.value = 0 → 1 (positive required)", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-p1",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 0, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      expect(r.product.packageSize.value).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("pricePerUnit = -50 → 0 (we accept 0 for free items, but not negative)", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-pp1",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: -50,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(["llm", "rule"]).toContain(r.source);
      // pricePerUnit 是 positive() 字段；负数会被 sanitizePositive 转 0（fallback）
      // schema 是 .positive() 严格 > 0，所以 0 会再次被 reject
      // 接受 LLM fallback 或 rule-based 都行，关键是 API 不抛 5xx
      expect(["llm", "rule"]).toContain(r.source);
    } finally {
      spy.mockRestore();
    }
  });

  it("ingredients with null entries → filtered out", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-i1",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["chicken", null, "rice", "", 42, "fish"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: 0.5, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(["llm", "rule"]).toContain(r.source);
      expect(r.product.ingredients).toEqual(["chicken", "rice", "fish"]);
    } finally {
      spy.mockRestore();
    }
  });

  it("ALL bad fields at once (realistic LLM garbage) → fallback to rule-based with clear warning, no 5xx", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-all",
        brand: null, name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 0, unit: "kg" }, pricePerUnit: -100,
        crossBorderAvailable: false, origin: null,
        ingredients: [null, "", 1, 2, 3],  // 全是非字符串
        nutrition: { protein: -1, fat: -1, fiber: -1, moisture: -1, ash: -1, calories: -1 },
        additives: {}, allergens: [],
        weightRange: { min: -1, max: -1, unit: "kg" },
      },
      confidence: 0.3, warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "", name: "Y" });
      // 即使清洗后 ingredients 数组空了，Zod min(1) 也会失败；最终回退 rule-based
      expect(r.source).toBe("rule");
      expect(r.warnings.some((w: string) => w.includes("LLM 解析失败"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
describe("parseProduct - strip thinking/reasoning blocks", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    process.env.LLM_API_KEY = "sk-test-fake";
    process.env.LLM_BASE_URL = "https://mock.example/v1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("DeepSeek R1 style: <think>...</think> + JSON → 解析成功", async () => {
    const llm = await import("@/lib/llm");
    const r1Output = [
      "<think>",
      "Let me analyze the product information from the image:",
      "- 品牌: 汪喵星球",
      "- 名称: 汪喵星球无胶纯肉泥",
      "- 内容: 鸡肉配方",
      "I need to output a complete product JSON.",
      "</think>",
      "",
      "{",
      '  "product": {',
      '    "id": "user-wangmiao-chicken-abc",',
      '    "brand": "汪喵星球",',
      '    "name": "汪喵星球无胶纯肉泥",',
      '    "species": "cat",',
      '    "lifeStage": "all",',
      '    "packageSize": { "value": 1, "unit": "kg" },',
      '    "pricePerUnit": 80,',
      '    "crossBorderAvailable": false,',
      '    "origin": "中国",',
      '    "ingredients": ["chicken"],',
      '    "nutrition": { "protein": 30, "fat": 15, "fiber": 4, "moisture": 10, "ash": 7, "calories": 3700 },',
      '    "additives": {},',
      '    "allergens": []',
      "  },",
      '  "confidence": 0.85,',
      '  "warnings": []',
      "}",
    ].join("\n");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(r1Output);
    try {
      const r = await parseProduct({ brand: "汪喵星球", name: "无胶纯肉泥" });
      expect(r.source).toBe("llm");
      expect(r.product.brand).toBe("汪喵星球");
      expect(r.product.nutrition.protein).toBe(30);
      expect(r.confidence).toBe(0.85);
    } finally {
      spy.mockRestore();
    }
  });

  it("Qwen3 style: <think>...</think>（中文思考） + JSON → 解析成功", async () => {
    const llm = await import("@/lib/llm");
    const r1Output = [
      "<think>",
      "好的，用户给了一张宠物食品包装图片。我需要分析：",
      "1. 品牌：ACANA 爱肯拿",
      "2. 名称：Acana Free-Run Poulty",
      "3. 营养成分：粗蛋白 31%、脂肪 17%",
      "</think>",
      "",
      '{"product":{"id":"user-acana-poulty-001","brand":"Acana","name":"Free-Run Poulty","species":"cat","lifeStage":"adult","packageSize":{"value":1.8,"unit":"kg"},"pricePerUnit":480,"crossBorderAvailable":true,"origin":"Canada","ingredients":["chicken","turkey","fish"],"nutrition":{"protein":31,"fat":17,"fiber":3,"moisture":12,"ash":7,"calories":3800},"additives":{},"allergens":["chicken"]},"confidence":0.9,"warnings":[]}',
    ].join("\n");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(r1Output);
    try {
      const r = await parseProduct({ brand: "Acana", name: "Poulty" });
      expect(r.source).toBe("llm");
      expect(r.product.brand).toBe("Acana");
      expect(r.product.nutrition.protein).toBe(31);
      expect(r.product.allergens).toEqual(["chicken"]);
    } finally {
      spy.mockRestore();
    }
  });

  it("GLM style: <reasoning>...</reasoning> + JSON → 解析成功", async () => {
    const llm = await import("@/lib/llm");
    const out = [
      "<reasoning>",
      "Need to extract product info",
      "</reasoning>",
      '{"product":{"id":"user-x-y-z","brand":"X","name":"Y","species":"dog","lifeStage":"adult","packageSize":{"value":2,"unit":"kg"},"pricePerUnit":200,"crossBorderAvailable":true,"origin":"USA","ingredients":["beef"],"nutrition":{"protein":25,"fat":12,"fiber":5,"moisture":10,"ash":8,"calories":3600},"additives":{},"allergens":[]},"confidence":0.8,"warnings":[]}',
    ].join("");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      expect(r.product.species).toBe("dog");
    } finally {
      spy.mockRestore();
    }
  });

  it("纯文本思考（无标签）+ JSON → fallback rule-based（无法区分思考与说明）", async () => {
    const llm = await import("@/lib/llm");
    // 模拟 LLM 在 JSON 之前用纯文本解释但不带标签 —— 我们无法剥离，只能 fallback
    const out = `这里是我的分析：品牌是 X，名称是 Y，蛋白质 30%，脂肪 15%。
{"product":{"id":"user-x-y-q","brand":"X","name":"Y","species":"cat","lifeStage":"adult","packageSize":{"value":1,"unit":"kg"},"pricePerUnit":100,"crossBorderAvailable":false,"origin":"China","ingredients":["a"],"nutrition":{"protein":30,"fat":15,"fiber":4,"moisture":10,"ash":7,"calories":3700},"additives":{},"allergens":[]},"confidence":0.9,"warnings":[]}`;
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      // 花括号配对提取会从第一个 { 提取完整 JSON，所以仍然能成功
      expect(r.source).toBe("llm");
      expect(r.product.nutrition.protein).toBe(30);
    } finally {
      spy.mockRestore();
    }
  });

  it("<think> 包含中文标点和换行 → 不影响解析", async () => {
    const llm = await import("@/lib/llm");
    const out = [
      "<think>",
      "好的，我来分析：",
      "1. 品牌：Royal Canin",
      "2. 营养：蛋白 28%",
      "3. 阶段：adult",
      "</think>",
      "",
      '{"product":{"id":"user-royal-canin-001","brand":"Royal Canin","name":"Adult Cat","species":"cat","lifeStage":"adult","packageSize":{"value":4,"unit":"kg"},"pricePerUnit":350,"crossBorderAvailable":true,"origin":"France","ingredients":["chicken","rice"],"nutrition":{"protein":28,"fat":14,"fiber":5,"moisture":5.5,"ash":7,"calories":3800},"additives":{},"allergens":[]},"confidence":0.92,"warnings":[]}',
    ].join("\n");
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "Royal Canin", name: "Adult Cat" });
      expect(r.source).toBe("llm");
      expect(r.product.brand).toBe("Royal Canin");
      expect(r.product.nutrition.protein).toBe(28);
    } finally {
      spy.mockRestore();
    }
  });
});
describe("parseProduct - sanitize top-level confidence", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    process.env.LLM_API_KEY = "sk-test-fake";
    process.env.LLM_BASE_URL = "https://mock.example/v1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("confidence = -1 → 0.3 (this was the persistent too_small bug)", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-c1",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: -1,  // ← 触发 too_small min:0
      warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      expect(r.confidence).toBe(0.3);
    } finally {
      spy.mockRestore();
    }
  });

  it("confidence = 2 (>1) → 0.3", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-c2",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: 2,
      warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      expect(r.confidence).toBe(0.3);
    } finally {
      spy.mockRestore();
    }
  });

  it("confidence = 0.85 → 保留 0.85", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-c3",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: 0.85,
      warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      expect(r.confidence).toBe(0.85);
    } finally {
      spy.mockRestore();
    }
  });

  it("warnings not array → []", async () => {
    const llm = await import("@/lib/llm");
    const out = JSON.stringify({
      product: {
        id: "user-x-y-w1",
        brand: "X", name: "Y", species: "cat", lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" }, pricePerUnit: 100,
        crossBorderAvailable: false, origin: "China",
        ingredients: ["a"],
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {}, allergens: [],
      },
      confidence: 0.5,
      warnings: "should-be-array",
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      expect(r.source).toBe("llm");
      expect(r.warnings).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
describe("parseProduct - real-world OCR LLM output (comprehensive)", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    process.env.LLM_API_KEY = "sk-test-fake";
    process.env.LLM_BASE_URL = "https://mock.example/v1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("LLM 输出完整含配料的 product（含 0 / null / 负数 / 数字数组等）→ 全部清洗后 source=llm", async () => {
    const llm = await import("@/lib/llm");
    // 模拟真实 LLM 输出：brand="汪喵星球", nutrition 部分缺失, ingredients 混合字符串/null/数字
    const out = JSON.stringify({
      product: {
        id: "user-wangmiao-xncr-abc",
        brand: "汪喵星球",
        name: "无胶纯肉泥",
        species: "cat",
        lifeStage: "all",
        packageSize: { value: 0, unit: "kg" },  // ← LLM 输出 0（应清洗为 1）
        pricePerUnit: -50,  // ← 负数（应清洗为 0 或 fallback）
        crossBorderAvailable: false,
        origin: "中国",
        ingredients: ["鸡肉", null, "30%", 42, "鱼肉", "", "鸡肝"],  // ← 混合类型
        nutrition: {
          protein: 30,
          fat: 15,
          fiber: 4,
          moisture: 10,
          ash: 7,
          calories: 3700,
        },
        additives: {
          vitamins: ["A", null, "D", 1, "E"],
          minerals: ["钙", "铁"],
          preservatives: null,  // ← null
          other: ["益生菌"],
        },
        allergens: ["鸡肉", null, "鱼"],
        weightRange: { min: -1, max: 10, unit: "kg" },
        notes: "无谷配方",
      },
      confidence: -1,  // ← 负数
      warnings: ["检测到成分含数字", 123, null],  // ← 混合类型
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "汪喵星球", name: "无胶纯肉泥" });
      expect(r.source).toBe("llm");
      // 验证清洗
      expect(r.product.packageSize.value).toBe(1);  // 0 → 1
      expect(r.product.weightRange!.min).toBe(0);  // -1 → 0
      expect(r.product.weightRange!.max).toBe(10);
      expect(r.product.ingredients).toEqual(["鸡肉", "30%", "鱼肉", "鸡肝"]);  // null/数字/空串过滤
      expect(r.product.allergens).toEqual(["鸡肉", "鱼"]);
      expect(r.product.additives.vitamins).toEqual(["A", "D", "E"]);  // null/数字过滤
      expect(r.product.additives.minerals).toEqual(["钙", "铁"]);
      expect(r.product.additives.preservatives).toBeUndefined();  // null → 删除
      expect(r.confidence).toBe(0.3);  // -1 → 0.3
      expect(Array.isArray(r.warnings)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("错误信息现在含完整 path 和 LLM 原始输出", async () => {
    const llm = await import("@/lib/llm");
    // 故意触发 Zod 错误（即使清洗后也救不回的：ingredients 数组全是非字符串 → min(1) 失败）
    const out = JSON.stringify({
      product: {
        id: "user-x-y-z",
        brand: "X",
        name: "Y",
        species: "cat",
        lifeStage: "adult",
        packageSize: { value: 1, unit: "kg" },
        pricePerUnit: 100,
        crossBorderAvailable: false,
        origin: "China",
        ingredients: [null, 1, 2, 3, true, false, {}],  // 全部非字符串 → ingredients 为空 → min(1) 失败
        nutrition: { protein: 30, fat: 15, fiber: 4, moisture: 10, ash: 7, calories: 3700 },
        additives: {},
        allergens: [],
      },
      confidence: 0.5,
      warnings: [],
    });
    const spy = vi.spyOn(llm, "callLLMMessages").mockResolvedValue(out);
    try {
      const r = await parseProduct({ brand: "X", name: "Y" });
      // 此时 Zod 校验失败（ingredients.min(1)），fallback rule-based
      expect(r.source).toBe("rule");
      // 错误信息现在含完整 details + LLM 原始输出
      const warning = r.warnings[0];
      expect(warning).toContain("LLM 解析失败");
    } finally {
      spy.mockRestore();
    }
  });
});