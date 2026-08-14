"use client";

import { useEffect, useState } from "react";
import PetForm, { PetFormValue, defaultPet } from "@/components/PetForm";
import RecommendationList from "@/components/RecommendationList";
import AddProductModal from "@/components/AddProductModal";
import { getAllUserProducts } from "@/lib/userProducts";
import productsData from "@/data/products.json";
import type { Product, RecommendResponse, UserProduct } from "@/types";

const builtinProducts = productsData as Product[];

export default function RecommendPage() {
  const [pet, setPet] = useState<PetFormValue>(defaultPet);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setUserProducts(getAllUserProducts());
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    // 每次提交时拉一次最新的用户商品
    const ups = getAllUserProducts();
    setUserProducts(ups);
    try {
      const r = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet, userProducts: ups }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error("API " + r.status + ": " + text);
      }
      const data = (await r.json()) as RecommendResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // 把 builtin + user 合并传给展示组件
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
            <h1 className="text-2xl font-bold text-slate-900">① 个性化推荐</h1>
            <p className="text-sm text-slate-500 mt-1">
              填写宠物信息，AI 将基于物种、阶段、过敏与预算，从内置商品库（{builtinProducts.length} 款）
              {userProducts.length > 0 && <span> + 你的库（{userProducts.length} 款）</span>}
              推荐 3-5 款主粮。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-sm text-brand-600 hover:text-brand-700 hover:underline whitespace-nowrap"
            data-testid="add-product-link"
          >
            + 添加商品
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">宠物信息</h2>
          <PetForm onChange={setPet} />
          <button
            type="button"
            className="btn-primary w-full"
            disabled={loading}
            onClick={submit}
            data-testid="submit-recommend"
          >
            {loading ? "推荐中..." : "获取推荐"}
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
              左侧填写宠物信息，点击&quot;获取推荐&quot;后，结果会出现在这里。
            </div>
          ) : (
            <RecommendationList data={result} products={allProducts} />
          )}
        </section>
      </div>
      <AddProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(p) => { setModalOpen(false); setUserProducts(getAllUserProducts()); void p; }}
        onRemoved={() => { setUserProducts(getAllUserProducts()); }}
      />
    </div>
  );
}
