import type { Product } from "@/types";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-brand-600 font-semibold mb-1">
        {product.brand}
      </div>
      <div className="font-medium text-slate-900">{product.name}</div>
      <dl className="mt-2 text-xs text-slate-500 space-y-1">
        <div className="flex justify-between">
          <dt>价格</dt>
          <dd>¥{product.pricePerUnit} / {product.packageSize.value}{product.packageSize.unit}</dd>
        </div>
        <div className="flex justify-between">
          <dt>阶段</dt>
          <dd>{product.lifeStage}</dd>
        </div>
        <div className="flex justify-between">
          <dt>产地</dt>
          <dd>{product.origin}</dd>
        </div>
        <div className="flex justify-between">
          <dt>跨境</dt>
          <dd>{product.crossBorderAvailable ? "✓ 支持" : "✗ 不支持"}</dd>
        </div>
      </dl>
    </div>
  );
}
