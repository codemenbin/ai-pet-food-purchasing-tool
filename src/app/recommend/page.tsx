"use client";

import { useState } from "react";
import PetForm, { PetFormValue } from "@/components/PetForm";
import RecommendationList from "@/components/RecommendationList";
import productsData from "@/data/products.json";
import type { Product, RecommendResponse } from "@/types";

const products = productsData as Product[];

export default function RecommendPage() {
  const [pet, setPet] = useState<PetFormValue | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!pet) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pet),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`API ${r.status}: ${text}`);
      }
      const data = (await r.json()) as RecommendResponse;
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
        <h1 className="text-2xl font-bold text-slate-900">① 个性化推荐</h1>
        <p className="text-sm text-slate-500 mt-1">
          填写宠物信息，AI 将基于物种、阶段、过敏与预算，从内置商品库推荐 3-5 款主粮。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">宠物信息</h2>
          <PetForm onChange={setPet} />
          <button
            type="button"
            className="btn-primary w-full"
            disabled={loading || !pet}
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
              左侧填写宠物信息，点击「获取推荐」后，结果会出现在这里。
            </div>
          ) : (
            <RecommendationList data={result} products={products} />
          )}
        </section>
      </div>
    </div>
  );
}
