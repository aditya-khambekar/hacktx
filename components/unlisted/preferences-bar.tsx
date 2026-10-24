"use client";

import { useState } from "react";
import { formatUsd } from "./costs";
import { Close, Pencil, Plus } from "./icons";
import type { Preference } from "./types";

const SUGGESTIONS = ["Pet-friendly", "Furnished", "Parking included", "Private bathroom", "Under 10 min walk", "Pool or gym"];

export function budgetFromPreferences(preferences: Preference[]): number | null {
  const budget = preferences.find((p) => p.id === "budget");
  const amount = budget ? Number(budget.label.replace(/[^\d]/g, "")) : NaN;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

const budgetLabel = (amount: number) => `Up to ${formatUsd(amount)} / person`;

function slug(label: string) {
  return `custom-${label.toLowerCase().replace(/\W+/g, "-")}`;
}

type PreferencesBarProps = {
  preferences: Preference[];
  onChange: (preferences: Preference[]) => void;
};

export function PreferencesBar({ preferences, onChange }: PreferencesBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const has = (label: string) => preferences.some((p) => p.label.toLowerCase() === label.toLowerCase());

  function startEdit(preference: Preference) {
    setAdding(false);
    setEditingId(preference.id);
    setEditValue(preference.id === "budget" ? String(budgetFromPreferences([preference]) ?? "") : preference.label);
  }

  function commitEdit() {
    if (!editingId) return;
    const value = editValue.trim();
    if (editingId === "budget") {
      const amount = Number(value.replace(/[^\d]/g, ""));
      if (amount > 0) onChange(preferences.map((p) => (p.id === "budget" ? { ...p, label: budgetLabel(amount) } : p)));
    } else if (value && value.length <= 32) {
      onChange(preferences.map((p) => (p.id === editingId ? { ...p, label: value } : p)));
    }
    setEditingId(null);
  }

  function add(label: string) {
    const value = label.trim();
    if (!value || has(value)) return;
    onChange([...preferences, value === "Budget" ? { id: "budget", label: budgetLabel(1400) } : { id: slug(value), label: value }]);
    setDraft("");
  }

  const suggestions = [...(preferences.some((p) => p.id === "budget") ? [] : ["Budget"]), ...SUGGESTIONS.filter((s) => !has(s))];

  return (
    <section aria-labelledby="priorities-label" className="rounded-[10px] border border-line bg-paper-raised px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="priorities-label" className="text-[13px] font-semibold text-ink">
          Your priorities
        </h2>
        <p className="text-[11.5px] text-ink-soft">Click a priority to change it. The comparison and assistant use these.</p>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-2">
        {preferences.map((preference) => {
          const isBudget = preference.id === "budget";
          const tone = isBudget ? "border-clay/40 bg-clay-tint text-clay-dark" : "border-line bg-chip text-ink";
          if (editingId === preference.id) {
            return (
              <li key={preference.id}>
                <form
                  className={`flex h-[32px] items-center gap-1 rounded-md border-2 border-clay bg-paper-raised pr-1 pl-2.5 text-[13px]`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    commitEdit();
                  }}
                >
                  {isBudget && <span className="text-ink-soft">Up to $</span>}
                  <label className="sr-only" htmlFor={`edit-${preference.id}`}>
                    {isBudget ? "Monthly budget per person, in dollars" : `Edit ${preference.label}`}
                  </label>
                  <input
                    id={`edit-${preference.id}`}
                    autoFocus
                    inputMode={isBudget ? "numeric" : undefined}
                    value={editValue}
                    maxLength={isBudget ? 6 : 32}
                    onChange={(event) => setEditValue(isBudget ? event.target.value.replace(/[^\d]/g, "") : event.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(event) => event.key === "Escape" && setEditingId(null)}
                    className={`bg-transparent text-ink focus:outline-none ${isBudget ? "w-14 tabular-nums" : "w-36"}`}
                  />
                  {isBudget && <span className="text-ink-soft">/ person</span>}
                  <button type="submit" onMouseDown={(event) => event.preventDefault()} className="ml-1 rounded bg-clay px-2 py-0.5 text-[11.5px] font-semibold text-white">
                    Save
                  </button>
                </form>
              </li>
            );
          }
          return (
            <li key={preference.id} className={`flex h-[32px] items-center rounded-md border text-[13px] ${tone}`}>
              <button
                type="button"
                onClick={() => startEdit(preference)}
                className="group flex h-full items-center gap-1.5 rounded-l-md pr-1.5 pl-2.5 hover:bg-ink/5"
                aria-label={`Edit priority: ${preference.label}`}
              >
                {preference.label}
                <Pencil size={13} className="opacity-50 group-hover:opacity-100" />
              </button>
              <button
                type="button"
                onClick={() => onChange(preferences.filter((p) => p.id !== preference.id))}
                aria-label={`Remove priority: ${preference.label}`}
                className="grid h-full w-7 place-items-center rounded-r-md border-l border-current/15 opacity-60 hover:bg-ink/5 hover:opacity-100"
              >
                <Close size={13} />
              </button>
            </li>
          );
        })}

        <li>
          {adding ? (
            <form
              className="flex h-[32px] items-center gap-1 rounded-md border-2 border-clay bg-paper-raised pr-1 pl-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                add(draft);
              }}
            >
              <label className="sr-only" htmlFor="new-preference">
                New priority
              </label>
              <input
                id="new-preference"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Escape" && setAdding(false)}
                placeholder="e.g. Quiet building"
                maxLength={32}
                className="w-40 bg-transparent text-[13px] placeholder:text-ink-soft focus:outline-none"
              />
              <button type="submit" disabled={!draft.trim()} className="rounded bg-clay px-2 py-0.5 text-[11.5px] font-semibold text-white disabled:opacity-40">
                Add
              </button>
              <button type="button" onClick={() => setAdding(false)} aria-label="Stop adding" className="grid h-6 w-6 place-items-center rounded text-ink-soft hover:bg-chip">
                <Close size={13} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setAdding(true);
              }}
              className="flex h-[32px] items-center gap-1 rounded-md border border-dashed border-clay/60 px-2.5 text-[13px] font-medium text-clay-dark hover:bg-clay-tint"
            >
              <Plus size={14} />
              Add priority
            </button>
          )}
        </li>
      </ul>

      {adding && suggestions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11.5px] text-ink-soft">Suggestions:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-ink hover:border-clay/50 hover:bg-clay-tint"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
