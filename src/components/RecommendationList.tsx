"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, Recommendation, RecommendResponse } from "@/types";
import ProductCard from "./ProductCard";
import { addToCompareSelection } from "@/lib/userProducts";

export default function RecommendationList({
  data,
  products,
}: {
  data: RecommendResponse;
  products: Product[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const productMap = new Map(products.map((p) => [p.id, p]));

  function handleAddToCompare(productId: string) {
    addToCompareSelection(productId);
    setFeedback((s) => ({ ...s, [productId]: "✓ 已加入" }));
    setTimeout(() => setFeedback((s) => { const c = { ...s }; delete c[productId]; return c; }), 1500);
  }

  function handleGoCompare() {
    router.push("/compare");
  }

  return (
    <div className="space-y-4" data-testid="recommendation-list">
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">摘要</div>
            <p className="text-slate-800 text-sm">{data.summary}</p>
          </div>
          <button
            type="button"
            onClick={handleGoCompare}
            className="text-xs text-brand-600 hover:text-brand-700 hover:underline whitespace-nowrap"
            data-testid="go-compare-btn"
          >
            → 去对比页
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          数据源: <code>{data.source}</code>
        </div>
      </div>

      <ol className="space-y-3">
        {data.recommendations.map((rec) => {
          const product = productMap.get(rec.productId);
          if (!product) return null;
          return (
            <li
              key={rec.productId}
              className="rounded-xl border border-slate-200 bg-white p-4"
              data-testid={`recommendation-${rec.productId}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold">
                  {rec.rank}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-slate-900">
                      {product.brand} · {product.name}
                    </h3>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      score {rec.score}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{rec.reason}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleAddToCompare(rec.productId)}
                      className="text-xs px-2 py-1 rounded border border-brand-300 text-brand-700 hover:bg-brand-50"
                      data-testid={`add-to-compare-${rec.productId}`}
                    >
                      {feedback[rec.productId] ?? "+ 加入对比"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
