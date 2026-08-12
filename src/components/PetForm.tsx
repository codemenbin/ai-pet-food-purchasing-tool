"use client";

import { useState } from "react";
import type { PetInfo, LifeStage, Species } from "@/types";

export type PetFormValue = PetInfo;

export type PetFormProps = {
  initial?: Partial<PetInfo>;
  compact?: boolean;
  onChange?: (value: PetInfo) => void;
};

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "cat", label: "🐱 猫" },
  { value: "dog", label: "🐶 狗" },
];

const STAGE_OPTIONS: { value: LifeStage; label: string }[] = [
  { value: "puppy", label: "幼年" },
  { value: "adult", label: "成年" },
  { value: "senior", label: "老年" },
];

const ALLERGEN_PRESETS = ["chicken", "beef", "fish", "grain", "wheat", "corn"];

export default function PetForm({ initial, compact, onChange }: PetFormProps) {
  const [value, setValue] = useState<PetInfo>({
    species: initial?.species ?? "cat",
    breed: initial?.breed ?? "中华田园",
    ageStage: initial?.ageStage ?? "adult",
    weightKg: initial?.weightKg ?? 4,
    knownAllergens: initial?.knownAllergens ?? [],
    monthlyBudgetCNY: initial?.monthlyBudgetCNY ?? 400,
    destinationCountry: initial?.destinationCountry ?? "中国大陆",
  });

  function update<K extends keyof PetInfo>(key: K, v: PetInfo[K]) {
    const next = { ...value, [key]: v };
    setValue(next);
    onChange?.(next);
  }

  function toggleAllergen(a: string) {
    const has = value.knownAllergens.includes(a);
    update(
      "knownAllergens",
      has ? value.knownAllergens.filter((x) => x !== a) : [...value.knownAllergens, a]
    );
  }

  return (
    <div className="space-y-4" data-testid="pet-form">
      <div className="grid grid-cols-2 gap-3">
        <Field label="物种">
          <select
            className="input"
            value={value.species}
            onChange={(e) => update("species", e.target.value as Species)}
            data-testid="pet-species"
          >
            {SPECIES_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="阶段">
          <select
            className="input"
            value={value.ageStage}
            onChange={(e) => update("ageStage", e.target.value as LifeStage)}
            data-testid="pet-stage"
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="品种">
          <input
            className="input"
            type="text"
            value={value.breed}
            onChange={(e) => update("breed", e.target.value)}
            data-testid="pet-breed"
          />
        </Field>
        <Field label="体重 (kg)">
          <input
            className="input"
            type="number"
            min={0.1}
            step={0.1}
            value={value.weightKg}
            onChange={(e) => update("weightKg", Number(e.target.value))}
            data-testid="pet-weight"
          />
        </Field>
        <Field label="月预算 (CNY)">
          <input
            className="input"
            type="number"
            min={50}
            value={value.monthlyBudgetCNY}
            onChange={(e) => update("monthlyBudgetCNY", Number(e.target.value))}
            data-testid="pet-budget"
          />
        </Field>
        <Field label="跨境目的地">
          <input
            className="input"
            type="text"
            value={value.destinationCountry}
            onChange={(e) => update("destinationCountry", e.target.value)}
            data-testid="pet-destination"
          />
        </Field>
      </div>

      <Field label="已知过敏原（可多选）">
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_PRESETS.map((a) => {
            const active = value.knownAllergens.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAllergen(a)}
                className={
                  "px-3 py-1 rounded-full text-xs border transition " +
                  (active
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-600 border-slate-300 hover:border-brand-500")
                }
                data-testid={`allergen-${a}`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </Field>

      {compact && (
        <p className="text-xs text-slate-400">
          （精简表单：对比场景下只展示用于评分的字段）
        </p>
      )}

      {/* 当前值序列化，供测试断言 */}
      <input
        type="hidden"
        data-testid="pet-form-value"
        value={JSON.stringify(value)}
        readOnly
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
