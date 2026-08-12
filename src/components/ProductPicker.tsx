"use client";

import type { Product, Species } from "@/types";

export type ProductPickerProps = {
  products: Product[];
  selectedIds: string[];
  species?: Species;
  min?: number;
  max?: number;
  onChange: (ids: string[]) => void;
};

export default function ProductPicker({
  products,
  selectedIds,
  species,
  min = 2,
  max = 3,
  onChange,
}: ProductPickerProps) {
  const filtered = species ? products.filter((p) => p.species === species) : products;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else if (selectedIds.length < max) {
      onChange([...selectedIds, id]);
    }
  }

  function handleCardClick(id: string) {
    // 仅在点击非 checkbox 区域时触发；checkbox 走自己的 onChange
    toggle(id);
  }

  function handleCheckboxChange(e: React.ChangeEvent<HTMLInputElement>, id: string) {
    e.stopPropagation();
    toggle(id);
  }

  return (
    <div className="space-y-2" data-testid="product-picker">
      <div className="text-xs text-slate-500">
        已选 {selectedIds.length} / {max}（最少 {min}）
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-2">
        {filtered.map((p) => {
          const checked = selectedIds.includes(p.id);
          return (
            <li
              key={p.id}
              className={
                "border rounded-lg p-3 cursor-pointer transition text-sm " +
                (checked
                  ? "border-brand-600 bg-brand-50"
                  : "border-slate-200 bg-white hover:border-brand-400")
              }
              onClick={() => handleCardClick(p.id)}
              data-testid={`picker-item-${p.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">{p.brand} · {p.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    ¥{p.pricePerUnit} / {p.packageSize.value}
                    {p.packageSize.unit} · {p.lifeStage} · {p.species}
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={(e) => handleCheckboxChange(e, p.id)}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`picker-checkbox-${p.id}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
