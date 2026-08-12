"use client";

import { useMemo, useState } from "react";
import PetForm, { PetFormValue } from "@/components/PetForm";
import ProductPicker from "@/components/ProductPicker";
import ComparisonTable from "@/components/ComparisonTable";
import productsData from "@/data/products.json";
import type { CompareResponse, Product } from "@/types";

const products = productsData as Product[];

export default function ComparePage() {
  const [pet, setPet] = useState<PetFormValue | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 推导过滤后的物种（按已选商品推断；未选时默认 cat）
  const inferredSpecies = useMemo(() => {
    if (selectedIds.length === 0) return pet?.species ?? "cat";
    const sel = products.filter((p) => selectedIds.includes(p.id));
    return sel[0]?.species ?? pet?.species ?? "cat";
  }, [selectedIds, pet, products]);

  async function submit() {
    if (!pet || selectedIds.length < 2) {
      setError("请至少选择 2 款商品，并填写宠物信息");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedIds, pet }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`API ${r.status}: ${text}`);
      }
      const data = (await r.json()) as CompareResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">② 配料表对比</h1>
        <p className="text-sm text-slate-500 mt-1">
          挑选 2-3 款商品，AI 将输出营养 / 添加剂 / 过敏原 / 适配度的结构化对比。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">选择商品</h2>
          <ProductPicker
            products={products}
            selectedIds={selectedIds}
            species={inferredSpecies}
            min={2}
            max={3}
            onChange={setSelectedIds}
          />

          <h2 className="font-semibold text-slate-900 pt-4">宠物信息</h2>
          <PetForm
            compact
            initial={pet ?? undefined}
            onChange={setPet}
          />

          <button
            type="button"
            className="btn-primary w-full"
            disabled={loading || selectedIds.length < 2 || !pet}
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
              挑选商品 + 填写宠物信息，点击「开始对比」后，结果会出现在这里。
            </div>
          ) : (
            <ComparisonTable data={result} products={products} />
          )}
        </section>
      </div>
    </div>
  );
}
