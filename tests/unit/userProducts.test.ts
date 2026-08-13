import { describe, it, expect, beforeEach } from "vitest";
import {
  makeUserProductId,
  addUserProduct,
  getAllUserProducts,
  removeUserProduct,
  clearUserProducts,
  getCompareSelection,
  setCompareSelection,
  addToCompareSelection,
  removeFromCompareSelection,
  clearCompareSelection,
} from "@/lib/userProducts";
import type { UserProduct } from "@/types";

class FakeStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  key(index: number): string | null {
    if (index < 0 || index >= this.store.size) return null;
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k) ?? null : null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  clear(): void { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { window: Window }).window = {
    localStorage: new FakeStorage(),
  } as unknown as Window;
});

describe("userProducts - ID", () => {
  it("ID has user- prefix + slug + timestamp", () => {
    const id = makeUserProductId("Royal Canin", "Indoor Cat");
    expect(id.startsWith("user-royal-canin-indoor-cat-")).toBe(true);
  });
  it("special chars normalized to hyphen", () => {
    const id = makeUserProductId("A&B", "C/D E");
    expect(id).toMatch(/^user-a-b-c-d-e-[a-z0-9]+$/);
  });
  it("two calls separated by ms return different IDs", async () => {
    const a = makeUserProductId("X", "Y");
    await new Promise((r) => setTimeout(r, 5));
    const b = makeUserProductId("X", "Y");
    expect(a).not.toBe(b);
  });
});

describe("userProducts - CRUD", () => {
  beforeEach(() => clearUserProducts());
  it("add + getAll consistent", () => {
    const p = makeFakeProduct("u1", "Acme", "Salmon Cat");
    addUserProduct(p);
    expect(getAllUserProducts()).toHaveLength(1);
    expect(getAllUserProducts()[0]!.id).toBe("u1");
  });
  it("same ID overwrites (no duplicates)", () => {
    addUserProduct(makeFakeProduct("u1", "Acme", "v1"));
    addUserProduct(makeFakeProduct("u1", "Acme", "v2"));
    expect(getAllUserProducts()).toHaveLength(1);
    expect(getAllUserProducts()[0]!.name).toBe("v2");
  });
  it("remove deletes single item", () => {
    addUserProduct(makeFakeProduct("u1", "A", "x"));
    addUserProduct(makeFakeProduct("u2", "B", "y"));
    removeUserProduct("u1");
    expect(getAllUserProducts().map((p) => p.id)).toEqual(["u2"]);
  });
  it("corrupt JSON returns empty array (no throw)", () => {
    globalThis.window.localStorage.setItem("ai-pet-food.userProducts.v1", "{not-json");
    expect(getAllUserProducts()).toEqual([]);
  });
  it("invalid-schema items silently dropped", () => {
    globalThis.window.localStorage.setItem(
      "ai-pet-food.userProducts.v1",
      JSON.stringify([{ foo: "bar" }, makeFakeProduct("u1", "A", "x")])
    );
    const list = getAllUserProducts();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("u1");
  });
});

describe("userProducts - compare selection (max=3)", () => {
  beforeEach(() => clearCompareSelection());
  it("default empty", () => {
    expect(getCompareSelection()).toEqual([]);
  });
  it("add truncates to 3", () => {
    addToCompareSelection("a");
    addToCompareSelection("b");
    addToCompareSelection("c");
    addToCompareSelection("d");
    expect(getCompareSelection()).toEqual(["b", "c", "d"]);
  });
  it("duplicate add no-op", () => {
    addToCompareSelection("a");
    addToCompareSelection("a");
    expect(getCompareSelection()).toEqual(["a"]);
  });
  it("remove + set + clear work", () => {
    setCompareSelection(["a", "b", "c"]);
    removeFromCompareSelection("b");
    expect(getCompareSelection()).toEqual(["a", "c"]);
    clearCompareSelection();
    expect(getCompareSelection()).toEqual([]);
  });
});

function makeFakeProduct(id: string, brand: string, name: string): UserProduct {
  return {
    id, brand, name,
    species: "cat",
    lifeStage: "adult",
    packageSize: { value: 1, unit: "kg" },
    pricePerUnit: 100,
    crossBorderAvailable: true,
    origin: "test",
    ingredients: ["chicken"],
    nutrition: { protein: 30, fat: 15, fiber: 5, moisture: 10, ash: 8, calories: 3500 },
    additives: {},
    allergens: [],
    meta: { source: "user", addedAt: Date.now() },
  };
}
