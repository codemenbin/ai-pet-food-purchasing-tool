"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, RecommendResponse } from "@/types";
import {
  addToCompareSelection,
  getCompareSelection,
  removeFromCompareSelection,
} from "@/lib/userProducts";

export default function RecommendationList({
  data,
  products,
}: {
  data: RecommendResponse;
  products: Product[];
}) {
  const router = useRouter();
  // 已加入对比的商品 ID 集合（持久化在 localStorage）
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  // 短反馈提示：刚刚点击的 productId
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // 挂载时同步一次；其他页面可能改了 localStorage
  useEffect(() => {
    setCompareIds(new Set(getCompareSelection()));
  }, []);

  // 清理定时器
  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(null), 1500);
    return () => clearTimeout(t);
  }, [justAdded]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  function handleToggleCompare(productId: string) {
    if (compareIds.has(productId)) {
      // 已加入 → 移除
      removeFromCompareSelection(productId);
      const next = new Set(compareIds);
      next.delete(productId);
      setCompareIds(next);
    } else {
      // 未加入 → 添加
      addToCompareSelection(productId);
      const next = new Set(compareIds);
      next.add(productId);
      setCompareIds(next);
      setJustAdded(productId);
    }
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
          const isInCompare = compareIds.has(rec.productId);
          const isJustAdded = justAdded === rec.productId;
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
                      onClick={() => handleToggleCompare(rec.productId)}
                      className={
                        isInCompare
                          ? "text-xs px-2 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "text-xs px-2 py-1 rounded border border-brand-300 text-brand-700 hover:bg-brand-50"
                      }
                      data-testid={`add-to-compare-${rec.productId}`}
                    >
                      {isInCompare
                        ? isJustAdded
                          ? "✓ 已加入"
                          : "✓ 已加入"
                        : "+ 加入对比"}
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
