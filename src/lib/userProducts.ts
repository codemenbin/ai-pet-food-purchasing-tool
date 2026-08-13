/**
 * 用户商品库（localStorage CRUD）
 * - 用户手动添加 / OCR / LLM 推断的商品存在浏览器本地
 * - 服务端拿不到；前端组件按需读取
 * - SSR 安全：用 typeof window 判断
 */

import { UserProductSchema, type UserProduct } from "@/types";

const STORAGE_KEY = "ai-pet-food.userProducts.v1";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse(raw: string | null): UserProduct[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: UserProduct[] = [];
    for (const item of arr) {
      const r = UserProductSchema.safeParse(item);
      if (r.success) out.push(r.data);
      // 校验失败的项静默丢弃，避免坏数据阻塞整个列表
    }
    return out;
  } catch {
    return [];
  }
}

export function getAllUserProducts(): UserProduct[] {
  if (!hasWindow()) return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function getUserProductById(id: string): UserProduct | undefined {
  return getAllUserProducts().find((p) => p.id === id);
}

export function addUserProduct(p: UserProduct): void {
  if (!hasWindow()) return;
  const list = getAllUserProducts();
  // 同 ID 覆盖
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function removeUserProduct(id: string): void {
  if (!hasWindow()) return;
  const list = getAllUserProducts().filter((p) => p.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearUserProducts(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// 比较页临时选中的商品 ID（跨页面流转）
const COMPARE_SELECTION_KEY = "ai-pet-food.compareSelection.v1";

export function getCompareSelection(): string[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_SELECTION_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setCompareSelection(ids: string[]): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(COMPARE_SELECTION_KEY, JSON.stringify(ids));
}

export function addToCompareSelection(id: string): string[] {
  const cur = getCompareSelection();
  if (cur.includes(id)) return cur;
  // 比较页 max=3；超出截断
  const next = [...cur, id].slice(-3);
  setCompareSelection(next);
  return next;
}

export function removeFromCompareSelection(id: string): string[] {
  const cur = getCompareSelection().filter((x) => x !== id);
  setCompareSelection(cur);
  return cur;
}

export function clearCompareSelection(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(COMPARE_SELECTION_KEY);
}

// 生成用户商品 ID（避免与 builtin 冲突，前缀 user-）
export function makeUserProductId(brand: string, name: string): string {
  const slug = (brand + "-" + name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return "user-" + slug + "-" + Date.now().toString(36);
}
