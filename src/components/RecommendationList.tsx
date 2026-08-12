import type { Product, Recommendation, RecommendResponse } from "@/types";
import ProductCard from "./ProductCard";

export default function RecommendationList({
  data,
  products,
}: {
  data: RecommendResponse;
  products: Product[];
}) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return (
    <div className="space-y-4" data-testid="recommendation-list">
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
        <div className="text-xs text-slate-500 mb-1">摘要</div>
        <p className="text-slate-800 text-sm">{data.summary}</p>
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
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">
                      {product.brand} · {product.name}
                    </h3>
                    <span className="text-xs text-slate-500">
                      score {rec.score}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{rec.reason}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
