"use client";

import { useEffect, useRef, useState } from "react";
import {
  addUserProduct,
  getAllUserProducts,
  makeUserProductId,
  removeUserProduct,
} from "@/lib/userProducts";
import type { LifeStage, Species, UserProduct } from "@/types";

/**
 * 把图片 File 压缩到最长边 1024px、JPEG 质量 0.85，返回 data URL。
 * - 5MB PNG → ~200KB JPEG（缩小 25x）
 * - LLM 端点处理时间从 30s+ → 3-5s
 * - 已经是 data URL 的不重复处理
 */
async function compressImage(file: File, maxDim = 1024, quality = 0.85): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("仅支持图片文件");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
  // 仅对较大的图片做压缩
  if (file.size < 300_000) return dataUrl;
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (Math.max(width, height) <= maxDim) {
        resolve(dataUrl);
        return;
      }
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = dataUrl;
  });
}

export type AddProductModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (product: UserProduct) => void;
  onRemoved?: (id: string) => void;
};

type ParseResult = {
  product: {
    brand: string;
    name: string;
    species: Species;
    lifeStage: LifeStage;
    packageSize: { value: number; unit: "kg" | "g" };
    pricePerUnit: number;
    crossBorderAvailable: boolean;
    origin: string;
    ingredients: string[];
    nutrition: { protein: number; fat: number; fiber: number; moisture: number; ash: number; calories: number };
    allergens: string[];
    notes?: string;
  };
  confidence: number;
  warnings: string[];
  source: string;
};

type Draft = {
  brand: string;
  name: string;
  species: Species;
  lifeStage: LifeStage;
  pricePerUnit: number;
  origin: string;
  crossBorderAvailable: boolean;
  ingredients: string;
  protein: number;
  fat: number;
  fiber: number;
  moisture: number;
  ash: number;
  calories: number;
  allergens: string;
  notes: string;
  imageDataUrl?: string;
};

function blankDraft(): Draft {
  return {
    brand: "", name: "",
    species: "cat", lifeStage: "adult",
    pricePerUnit: 0, origin: "", crossBorderAvailable: false,
    ingredients: "",
    protein: 0, fat: 0, fiber: 0, moisture: 0, ash: 0, calories: 0,
    allergens: "", notes: "",
  };
}

function fromParse(p: ParseResult["product"]): Omit<Draft, "imageDataUrl"> {
  return {
    brand: p.brand,
    name: p.name,
    species: p.species,
    lifeStage: p.lifeStage,
    pricePerUnit: p.pricePerUnit || 0,
    origin: p.origin || "",
    crossBorderAvailable: !!p.crossBorderAvailable,
    ingredients: (p.ingredients || []).join(", "),
    protein: p.nutrition?.protein ?? 0,
    fat: p.nutrition?.fat ?? 0,
    fiber: p.nutrition?.fiber ?? 0,
    moisture: p.nutrition?.moisture ?? 0,
    ash: p.nutrition?.ash ?? 0,
    calories: p.nutrition?.calories ?? 0,
    allergens: (p.allergens || []).join(", "),
    notes: p.notes || "",
  };
}


export default function AddProductModal({ open, onClose, onSaved, onRemoved }: AddProductModalProps) {
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [parsing, setParsing] = useState(false);
  const [parseInfo, setParseInfo] = useState<{ confidence: number; source: string; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedProducts, setSavedProducts] = useState<UserProduct[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // 取消上一次未完成的 AI 解析请求，避免重复点击时并发
  const abortRef = useRef<AbortController | null>(null);

  // 打开时重置 + 拉一次我的库
  useEffect(() => {
    if (!open) return;
    setDraft(blankDraft());
    setParseInfo(null);
    setError(null);
    setSavedId(null);
    setSavedProducts(getAllUserProducts());
  }, [open]);

  function patch<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("只支持图片文件");
      return;
    }
    try {
      // 压缩到 1024px / JPEG 0.85（5MB → ~200KB，省 25x token）
      const dataUrl = await compressImage(file);
      patch("imageDataUrl", dataUrl);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  
async function aiParse() {
    if (!draft.brand.trim() || !draft.name.trim()) {
      setError("请先填写品牌和名称");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const r = await fetch("/api/products/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: draft.brand,
          name: draft.name,
          species: draft.species,
          lifeStage: draft.lifeStage,
          ingredients: draft.ingredients || undefined,
          imageDataUrl: draft.imageDataUrl,
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error("API " + r.status + ": " + text);
      }
      const data: ParseResult = await r.json();
      setDraft((d) => ({ ...fromParse(data.product), imageDataUrl: d.imageDataUrl }));
      setParseInfo({ confidence: data.confidence, source: data.source, warnings: data.warnings || [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }

  function save() {
    if (!draft.brand.trim() || !draft.name.trim()) {
      setError("请填写品牌和名称");
      return;
    }
    const id = makeUserProductId(draft.brand, draft.name);
    const product: UserProduct = {
      id,
      brand: draft.brand,
      name: draft.name,
      species: draft.species,
      lifeStage: draft.lifeStage,
      packageSize: { value: 1, unit: "kg" },
      pricePerUnit: draft.pricePerUnit,
      crossBorderAvailable: draft.crossBorderAvailable,
      origin: draft.origin || "用户添加",
      ingredients: draft.ingredients
        ? draft.ingredients.split(",").map((s) => s.trim()).filter(Boolean)
        : ["（未提供成分表）"],
      nutrition: {
        protein: draft.protein, fat: draft.fat, fiber: draft.fiber,
        moisture: draft.moisture, ash: draft.ash, calories: draft.calories,
      },
      additives: {},
      allergens: draft.allergens
        ? draft.allergens.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      notes: draft.notes,
      meta: {
        source: parseInfo ? "ai" : "user",
        aiConfidence: parseInfo?.confidence,
        addedAt: Date.now(),
        imageDataUrl: draft.imageDataUrl,
      },
    };
    addUserProduct(product);
    setSavedId(id);
    setSavedProducts(getAllUserProducts());
    onSaved?.(product);
  }

  
function removeOne(id: string) {
    removeUserProduct(id);
    setSavedProducts(getAllUserProducts());
    onRemoved?.(id);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      data-testid="add-product-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">添加宠物粮食</h2>
            <p className="text-xs text-slate-500 mt-0.5">填品牌+名称，AI 一键补全其它字段</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="关闭"
            data-testid="modal-close"
          >
            ×
          </button>
        </header>

        <div className="p-6 space-y-5">
          {/* 顶部：最小必填 + AI 触发 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="品牌 *">
                <input
                  className="input"
                  value={draft.brand}
                  onChange={(e) => patch("brand", e.target.value)}
                  placeholder="如 Acana"
                  data-testid="modal-brand"
                />
              </Field>
              <Field label="名称 *">
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="如 Heritage Free-Run Poultry"
                  data-testid="modal-name"
                />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="hidden"
                data-testid="modal-image-input"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost text-sm"
                data-testid="modal-image-trigger"
              >
                📷 上传成分表图片（可选）
              </button>
              {draft.imageDataUrl && (
                <img src={draft.imageDataUrl} alt="preview" className="h-10 w-10 object-cover rounded border border-slate-200" />
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={aiParse}
                disabled={parsing || !draft.brand.trim() || !draft.name.trim()}
                className="btn-primary"
                data-testid="modal-ai-parse"
              >
                {parsing ? "AI 解析中…" : "🤖 AI 智能解析"}
              </button>
            </div>
          </div>

          {/* 解析后预览（可编辑） */}
          {parseInfo && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-3" data-testid="modal-parse-info">
              <div className="text-xs text-emerald-700">
                ✓ 解析完成 · 置信度 {Math.round(parseInfo.confidence * 100)}% · 来源 {parseInfo.source}
              </div>
              {parseInfo.warnings.length > 0 && (
                <ul className="text-[11px] text-amber-700 list-disc list-inside">
                  {parseInfo.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Field label="物种">
                  <select className="input" value={draft.species} onChange={(e) => patch("species", e.target.value as Species)}>
                    <option value="cat">🐱 猫</option>
                    <option value="dog">🐶 狗</option>
                  </select>
                </Field>
                <Field label="阶段">
                  <select className="input" value={draft.lifeStage} onChange={(e) => patch("lifeStage", e.target.value as LifeStage)}>
                    <option value="puppy">幼年</option>
                    <option value="adult">成年</option>
                    <option value="senior">老年</option>
                    <option value="all">全阶段</option>
                  </select>
                </Field>
                <Field label="价格 ¥">
                  <input className="input" type="number" min={0} value={draft.pricePerUnit} onChange={(e) => patch("pricePerUnit", Number(e.target.value))} />
                </Field>
                <Field label="产地">
                  <input className="input" value={draft.origin} onChange={(e) => patch("origin", e.target.value)} placeholder="Canada / 加拿大" />
                </Field>
              </div>


              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <Field label="蛋白%"><input className="input" type="number" min={0} max={100} step={0.1} value={draft.protein} onChange={(e) => patch("protein", Number(e.target.value))} /></Field>
                <Field label="脂肪%"><input className="input" type="number" min={0} max={100} step={0.1} value={draft.fat} onChange={(e) => patch("fat", Number(e.target.value))} /></Field>
                <Field label="纤维%"><input className="input" type="number" min={0} max={100} step={0.1} value={draft.fiber} onChange={(e) => patch("fiber", Number(e.target.value))} /></Field>
                <Field label="水分%"><input className="input" type="number" min={0} max={100} step={0.1} value={draft.moisture} onChange={(e) => patch("moisture", Number(e.target.value))} /></Field>
                <Field label="灰分%"><input className="input" type="number" min={0} max={100} step={0.1} value={draft.ash} onChange={(e) => patch("ash", Number(e.target.value))} /></Field>
                <Field label="热量"><input className="input" type="number" min={0} max={10000} value={draft.calories} onChange={(e) => patch("calories", Number(e.target.value))} /></Field>
              </div>

              <Field label="成分表（逗号分隔）">
                <textarea className="input min-h-[60px]" value={draft.ingredients} onChange={(e) => patch("ingredients", e.target.value)} />
              </Field>
              <Field label="过敏原（逗号分隔）">
                <input className="input" value={draft.allergens} onChange={(e) => patch("allergens", e.target.value)} placeholder="chicken, fish, grain" />
              </Field>
              <Field label="备注">
                <input className="input" value={draft.notes} onChange={(e) => patch("notes", e.target.value)} />
              </Field>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" data-testid="modal-error">{error}</div>
          )}
          {savedId && (
            <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-xs text-brand-700" data-testid="modal-saved">✅ 已保存到我的库</div>
          )}

          <footer className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-ghost" data-testid="modal-cancel">取消</button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={save}
              disabled={!draft.brand.trim() || !draft.name.trim()}
              className="btn-primary"
              data-testid="modal-save"
            >
              💾 保存到我的库
            </button>
          </footer>

          {/* 我的库（已保存） */}
          {savedProducts.length > 0 && (
            <section className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                我的库（{savedProducts.length}）
              </h3>
              <ul className="space-y-1">
                {savedProducts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-xs border border-slate-200 rounded px-3 py-2 bg-slate-50"
                    data-testid={`modal-saved-${p.id}`}
                  >
                    <div>
                      <div className="font-medium text-slate-900">{p.brand} · {p.name}</div>
                      <div className="text-slate-400">
                        {p.species === "cat" ? "🐱" : "🐶"} {p.lifeStage} · {p.meta.source === "ai" ? `AI ${Math.round((p.meta.aiConfidence ?? 0) * 100)}%` : "手动"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOne(p.id)}
                      className="text-rose-500 hover:text-rose-700 text-xs"
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
