"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PetForm, { PetFormValue, defaultPet } from "@/components/PetForm";
import ProductPicker from "@/components/ProductPicker";
import ComparisonTable from "@/components/ComparisonTable";
import AddProductModal from "@/components/AddProductModal";
import { getAllUserProducts, getCompareSelection } from "@/lib/userProducts";
import productsData from "@/data/products.json";
import type { CompareResponse, Product, Species, UserProduct } from "@/types";

const builtinProducts = productsData as Product[];

function ComparePageInner() {
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

  // Bug 1: reset selection when species changes
  const prevSpeciesRef = useRef<Species>(pet?.species ?? "cat");
  useEffect(() => {
    const cur = pet?.species ?? "cat";
    if (prevSpeciesRef.current !== cur) {
      setSelectedIds([]);
      setResult(null);
      setError(null);
      prevSpeciesRef.current = cur;
    }
  }, [pet?.species]);

  // Bug 2: 新增/删除同步
  // - added：物种匹配 + 未满 3，自动勾选
  // - removed：从 selectedIds 中过滤掉，避免 picker 已消失但 state 残留
  const prevUserProductIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const curIds = new Set(userProducts.map((p) => p.id));
    const prevIds = prevUserProductIdsRef.current;
    const added = userProducts.filter((p) => !prevIds.has(p.id));
    const removed: string[] = [];
    prevIds.forEach((id) => { if (!curIds.has(id)) removed.push(id); });
    if (added.length > 0) {
      setSelectedIds((cur) => {
        const slotsLeft = 3 - cur.length;
        if (slotsLeft <= 0) return cur;
        const targetSpecies = pet?.species ?? "cat";
        const toAdd = added.filter((p) => p.species === targetSpecies).slice(0, slotsLeft);
        if (toAdd.length === 0) return cur;
        return [...cur, ...toAdd.map((p) => p.id)];
      });
    }
    if (removed.length > 0) {
      setSelectedIds((cur) => {
        const next = cur.filter((id) => !removed.includes(id));
        return next.length === cur.length ? cur : next;
      });
    }
    prevUserProductIdsRef.current = curIds;
  }, [userProducts, pet?.species]);

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

  const allProducts: Product[] = userProducts
    .map((p) => {
      const { meta: _meta, ...rest } = p;
      return rest as Product;
    })
    .concat(builtinProducts);

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
        onSaved={(p) => {
          setModalOpen(false);
          setUserProducts(getAllUserProducts());
          if (p && selectedIds.length >= 3) {
            setError("已达 3 个上限，新商品已加入我的库，可手动取消其他商品后再次添加");
          }
        }}
        onRemoved={() => {
          // 删除走 onRemoved 回调：刷新我的库，移除选中同步 useEffect 处理
          setUserProducts(getAllUserProducts());
        }}
      />
    </div>
  );
}


/**
 * Next.js 14 prerender 要求使用 useSearchParams() 的客户端组件必须包在 <Suspense> 内
 * （否则 build 时报 "Error occurred prerendering page /compare"）
 * 这里把整页组件包一层 Suspense 默认 export
 */
export default function ComparePage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400 p-6">加载中…</div>}>
      <ComparePageInner />
    </Suspense>
  );
}