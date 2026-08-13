/**
 * 商品数据获取（三层回退链）
 *  1. live  实际爬虫（占位实现，默认返回空 + 错误）
 *  2. cache 持久化快照（data/products.cache.json，存在则用）
 *  3. mock  本地内置商品库（src/data/products.json，永远可用）
 *
 * 数据源选择规则：
 *  - DEMO_MODE=1 → 直接走 mock，跳过 live / cache
 *  - 否则先 live；live 出错或返回空数组时回退到 cache；仍空则 mock
 *  - 每次拉取都会记录 errors 与 source，供前端透明展示
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ProductSchema, type Product } from "@/types";
import productsData from "@/data/products.json";

export type ProductSource = "live" | "cache" | "mock";

export type FetchResult = {
  source: ProductSource;
  products: Product[];
  errors: string[];
  fetchedAt: number;
};

const CACHE_PATH = resolve(process.cwd(), "data/products.cache.json");
const MOCK_PRODUCTS = productsData as Product[];

function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}

/**
 * 真实爬虫占位实现
 * 真实场景下应该：
 *  - 调用多个跨境电商 API（京东国际 / 淘宝全球购 / Chewy 等）
 *  - 用 Zod 校验每条数据
 *  - 失败时记录到 errors 数组，不抛出
 *  - 支持按物种 / 跨境目的地过滤
 * 当前实现：返回空 + 错误，让上层走 cache / mock
 */
async function scrapeLive(): Promise<{ products: Product[]; errors: string[] }> {
  // 在真实环境里，这里会 fetch("https://api.example.com/pet-foods") 等
  return {
    products: [],
    errors: ["scrapeLive 未实现：请在 src/lib/scraper.ts 的 scrapeLive() 中接入真实数据源"],
  };
}

function readCache(): { products: Product[]; errors: string[] } {
  if (!existsSync(CACHE_PATH)) {
    return { products: [], errors: [] };
  }
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return { products: [], errors: ["cache 文件格式错误：非数组"] };
    }
    const products: Product[] = [];
    const errors: string[] = [];
    for (const item of data) {
      const r = ProductSchema.safeParse(item);
      if (r.success) products.push(r.data);
      else errors.push("cache 项校验失败: " + r.error.message.slice(0, 80));
    }
    return { products, errors };
  } catch (e) {
    return {
      products: [],
      errors: ["cache 读取失败: " + (e instanceof Error ? e.message : String(e))],
    };
  }
}

function readMock(): { products: Product[]; errors: string[] } {
  // 仍然用 Zod 做一次校验，防止 products.json 被改坏
  const products: Product[] = [];
  const errors: string[] = [];
  for (const item of MOCK_PRODUCTS) {
    const r = ProductSchema.safeParse(item);
    if (r.success) products.push(r.data);
    else errors.push("mock 项校验失败: " + r.error.message.slice(0, 80));
  }
  return { products, errors };
}

/**
 * 三层回退拉取商品数据
 */
export async function fetchProducts(): Promise<FetchResult> {
  const errors: string[] = [];
  const fetchedAt = Date.now();

  // DEMO 模式：跳过 live / cache，直接 mock（确定性 + 零成本）
  if (isDemoMode()) {
    const m = readMock();
    return { source: "mock", products: m.products, errors: m.errors, fetchedAt };
  }

  // 1) live
  try {
    const live = await scrapeLive();
    errors.push(...live.errors);
    if (live.products.length > 0) {
      return { source: "live", products: live.products, errors, fetchedAt };
    }
  } catch (e) {
    errors.push("live scrape 抛错: " + (e instanceof Error ? e.message : String(e)));
  }

  // 2) cache
  const cache = readCache();
  errors.push(...cache.errors);
  if (cache.products.length > 0) {
    return { source: "cache", products: cache.products, errors, fetchedAt };
  }

  // 3) mock（兜底，永远可用）
  const mock = readMock();
    errors.push(...mock.errors);
  return { source: "mock", products: mock.products, errors, fetchedAt };
}

