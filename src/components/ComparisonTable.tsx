"use client";

import type { CompareResponse, Product } from "@/types";
import { isSignificantDeviation } from "@/lib/comparator";

const NUTRITION_LABELS: Record<string, string> = {
  protein: "蛋白",
  fat: "脂肪",
  fiber: "纤维",
  moisture: "水分",
  ash: "灰分",
  calories: "热量",
};

/**
 * 营养成分偏离值算法说明：
 *  - 基准 = 当前行所有商品的均值
 *  - deviationPct = (value - avg) / avg × 100
 *  - 例如 Blue Buffalo 蛋白 42% / Acana 蛋白 36%，均值 39%
 *    → Blue Buffalo (+7.7%) / Acana (-7.7%)
 *  - 表格中以 "vs 均值" 标注，hover 显示绝对值基准
 */
function explainDeviation(deviationPct: number, value: number, isCalories: boolean): string {
  const unit = isCalories ? "kcal/kg" : "%";
  const abs = Math.abs(deviationPct);
  const direction = deviationPct > 0 ? "高于" : deviationPct < 0 ? "低于" : "等于";
  return `偏差 ${deviationPct > 0 ? "+" : ""}${deviationPct}%，相对均值 ${direction} ${abs.toFixed(1)}%（实际值 ${value}${unit}）`;
}

export default function ComparisonTable({
  data,
  products,
}: {
  data: CompareResponse;
  products: Product[];
}) {
  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-6" data-testid="comparison-table">
      {/* 顶部裁决 */}
      <div className="rounded-xl bg-brand-50 border border-brand-100 p-4">
        <div className="text-xs text-brand-700 mb-1 font-semibold">综合裁决</div>
        <p className="text-slate-800 text-sm leading-relaxed" data-testid="verdict">
          {data.verdict}
        </p>
        <div className="text-xs text-slate-400 mt-2">
          排序:{" "}
          {data.ranking.map((id, i) => (
            <span key={id} className="mr-2">
              {i + 1}. {productMap.get(id)?.brand ?? id}
            </span>
          ))}
          {" "}· 数据源: <code>{data.source}</code>
        </div>
      </div>

      {/* 营养成分矩阵 */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">营养成分</h3>
          <span className="text-[10px] text-slate-400" data-testid="nutrition-baseline-note">
            偏离值基准：与所选商品的均值对比
          </span>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">指标</th>
              {data.productIds.map((id) => (
                <th key={id} className="py-2 px-3 font-normal">
                  {productMap.get(id)?.brand ?? id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.nutritionDiffs.map((row) => {
              const avg = row.values.reduce((s, v) => s + v.value, 0) / row.values.length;
              return (
                <tr key={row.metric} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-500">
                    {NUTRITION_LABELS[row.metric] ?? row.metric}
                  </td>
                  {row.values.map((v) => {
                    const sig = isSignificantDeviation(row.metric, v.deviationPct);
                    const isCal = row.metric === "calories";
                    return (
                      <td
                        key={v.productId}
                        className={
                          "py-2 px-3 " +
                          (sig ? "bg-amber-50 text-amber-900 font-medium" : "text-slate-700")
                        }
                        data-testid={`nutrition-${row.metric}-${v.productId}`}
                      >
                        {isCal ? `${v.value} kcal/kg` : `${v.value}%`}
                        <span
                          className="text-[10px] text-slate-400 ml-1 cursor-help"
                          title={
                            explainDeviation(v.deviationPct, v.value, isCal) +
                            "（均值 " +
                            (isCal ? avg.toFixed(0) + " kcal/kg" : avg.toFixed(1) + "%") +
                            "）"
                          }
                        >
                          ({v.deviationPct > 0 ? "+" : ""}
                          {v.deviationPct}%)
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 过敏原矩阵 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">过敏原命中</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">商品</th>
              <th className="py-2 px-3">过敏原列表</th>
              <th className="py-2 px-3">与宠物过敏原命中</th>
            </tr>
          </thead>
          <tbody>
            {data.allergenMatrix.map((row) => {
              const hit = row.petAllergensHit.length > 0;
              return (
                <tr key={row.productId} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-700">
                    {productMap.get(row.productId)?.brand ?? row.productId}
                  </td>
                  <td className="py-2 px-3 text-slate-500">
                    {row.allergens.length === 0 ? (
                      <span className="text-emerald-600">无</span>
                    ) : (
                      row.allergens.join(", ")
                    )}
                  </td>
                  <td
                    className={
                      "py-2 px-3 " +
                      (hit ? "bg-rose-50 text-rose-700" : "text-emerald-600")
                    }
                    data-testid={`allergen-hit-${row.productId}`}
                  >
                    {hit ? `⚠ ${row.petAllergensHit.join(", ")}` : "✓ 安全"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 适配度评分 */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">适配度评分</h3>
        <ul className="space-y-2">
          {data.scores.map((s) => (
            <li
              key={s.productId}
              className="rounded-lg border border-slate-200 bg-white p-3"
              data-testid={`score-${s.productId}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-900">
                  {productMap.get(s.productId)?.brand ?? s.productId}
                </div>
                <div className="text-lg font-bold text-brand-600">{s.total}/100</div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-500 mb-2">
                <Bar label="阶段" value={s.lifeStage} max={30} />
                <Bar label="体重" value={s.weightRange} max={20} />
                <Bar label="过敏" value={s.allergen} max={30} />
                <Bar label="价格" value={s.price} max={20} />
              </div>
              <ul className="text-xs text-slate-500 space-y-0.5">
                {s.reasons.map((r, i) => (
                  <li key={i}>· {r}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
        <div
          className="h-full bg-brand-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
