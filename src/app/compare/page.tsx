"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PetForm, { PetFormValue, defaultPet } from "@/components/PetForm";
import ProductPicker from "@/components/ProductPicker";
import ComparisonTable from "@/components/ComparisonTable";
import AddProductModal from "@/components/AddProductModal";
import { getAllUserProducts, getCompareSelection } from "@/lib/userProducts";
import productsData from "@/data/products.json";
import type { CompareResponse, Product, UserProduct } from "@/types";

const builtinProducts = productsData as Product[];

export default function ComparePage() {
  const searchParams = useSearchParams();
  const [pet, setPet] = useState<PetFormValue>(defaultPet);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const ups = getAllUserProducts();
    setUserProducts(ups);
    // 初始化预选：URL ?ids=... > localStorage 暂存 > 空
    const fromUrl = searchParams.get("ids");
    if (fromUrl) {
      const ids = fromUrl.split(",").filter(Boolean).slice(0, 3);
      if (ids.length > 0) setSelectedIds(ids);
    } else {
      const saved = getCompareSelection();
      if (saved.length > 0) setSelectedIds(saved);
    }
  }, [searchParams]);

  const inferredSpecies = useMemo(() => {
    if (selectedIds.length === 0) return pet?.species ?? "cat";
    const all: Product[] = builtinProducts.concat(
      userProducts.map((p) => { const { meta: _m, ...r } = p; return r as Product; })
    );
    const sel = all.filter((p) => selectedIds.includes(p.id));
    return sel[0]?.species ?? pet?.species ?? "cat";
  }, [selectedIds, pet, userProducts]);

  async function submit() {
    if (!pet || selectedIds.length < 2) {
      setError("请至少选择 2 款商品，并填写宠物信息");
      return;
    }
    setLoading(true);
    setError(null);
    const ups = getAllUserProducts();
    setUserProducts(ups);
    try {
      const r = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedIds, pet, userProducts: ups }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error("API " + r.status + ": " + text);
      }
      const data = (await r.json()) as CompareResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const allProducts: Product[] = builtinProducts.concat(
    userProducts.map((p) => {
      const { meta: _meta, ...rest } = p;
      return rest as Product;
    })
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">② 配料表对比</h1>
            <p className="text-sm text-slate-500 mt-1">
              挑选 2-3 款商品，AI 将输出营养 / 添加剂 / 过敏原 / 适配度的结构化对比。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-sm text-brand-600 hover:text-brand-700 hover:underline whitespace-nowrap"
            data-testid="compare-add-product-link"
          >
            + 添加商品
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">选择商品</h2>
          <ProductPicker
            products={allProducts}
            selectedIds={selectedIds}
            species={inferredSpecies}
            min={2}
            max={3}
            onChange={setSelectedIds}
          />

          <h2 className="font-semibold text-slate-900 pt-4">宠物信息</h2>
          <PetForm compact initial={pet} onChange={setPet} />

          <button
            type="button"
            className="btn-primary w-full"
            disabled={loading || selectedIds.length < 2}
            onClick={submit}
            data-testid="submit-compare"
          >
            {loading ? "对比中..." : "开始对比"}
          </button>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3">
              {error}
            </div>
          )}
        </section>

        <section>
          {!result ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
              挑选商品 + 填写宠物信息，点击&quot;开始对比&quot;后，结果会出现在这里。
            </div>
          ) : (
            <ComparisonTable data={result} products={allProducts} />
          )}
        </section>
      </div>
      <AddProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); setUserProducts(getAllUserProducts()); }}
      />
    </div>
  );
}
