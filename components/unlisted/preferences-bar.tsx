"use client";

import { useState } from "react";
import { formatUsd } from "./costs";
import type { ComparisonApartment, Preference } from "./types";

const AMENITIES = [
  { id: "pets", label: "Pet friendly", pattern: /pet[- ]friendly|pets? allowed|dog[- ]friendly|cat[- ]friendly/i },
  { id: "pool", label: "Pool", pattern: /\bpool\b/i },
  { id: "parking", label: "Parking", pattern: /\bparking\b|garage/i },
  { id: "gym", label: "Gym", pattern: /\bgym\b|fitness/i },
  { id: "laundry", label: "In-unit laundry", pattern: /in[- ]unit (laundry|washer)|washer.*dryer/i },
  { id: "furnished", label: "Furnished", pattern: /\bfurnished\b/i },
];

export function budgetFromPreferences(preferences: Preference[]): number | null {
  const budget = preferences.find((p) => p.id === "budget");
  const amount = budget ? Number(budget.label.match(/[\d,]+/)?.[0].replace(/,/g, "")) : NaN;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Evaluate rent and room counts against the SAME sourced floor plan. */
export function matchesPreferences(apartment: ComparisonApartment, preferences: Preference[]): boolean {
  if (apartment.researchStatus === "loading" || apartment.researchStatus === "error") return true;
  const budget = budgetFromPreferences(preferences);
  const beds = Number(preferences.find((p) => p.id === "beds")?.label.match(/\d+/)?.[0]) || null;
  const baths = Number(preferences.find((p) => p.id === "baths")?.label.match(/[\d.]+/)?.[0]) || null;
  const basis = preferences.find((p) => p.id === "budget")?.label.includes("/ unit") ? "per unit" : "per person";
  const plans = apartment.profile?.floorplans ?? [{ beds: apartment.floorPlan.beds, baths: apartment.floorPlan.baths, baseRent: apartment.advertisedRent, rentBasis: apartment.rentBasis }];
  const allowUnknownRent = !preferences.some((p) => p.id === "budget-verified");
  const matchingPlans = plans.length ? plans : [{ beds: apartment.floorPlan.beds, baths: apartment.floorPlan.baths, baseRent: null, rentBasis: null }];
  if ((budget || beds || baths) && !matchingPlans.some((plan) =>
    (!beds || plan.beds === beds) && (!baths || (plan.baths !== null && plan.baths >= baths)) &&
    (!budget || (plan.baseRent === null || !plan.rentBasis || plan.rentBasis === "basis unknown"
      ? allowUnknownRent
      : plan.rentBasis === basis && plan.baseRent <= budget))
  )) return false;
  return AMENITIES.every((amenity) => !preferences.some((p) => p.id === `amenity-${amenity.id}`) || apartment.amenities.some((name) =>
    !/\b(no|not|without|unfurnished)\b/i.test(name) && amenity.pattern.test(name)
  ));
}

type Props = { preferences: Preference[]; onChange: (preferences: Preference[]) => void };
export function PreferencesBar({ preferences, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const budget = budgetFromPreferences(preferences);
  const basis = preferences.find((p) => p.id === "budget")?.label.includes("/ unit") ? "unit" : "person";
  const update = (id: string, label: string | null) => onChange([...preferences.filter((p) => p.id !== id), ...(label ? [{ id, label }] : [])]);
  const setBudget = (amount: number, nextBasis = basis) => update("budget", `Up to ${formatUsd(amount)} / ${nextBasis}`);
  const selectClass = "mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-clay";
  return (
    <section aria-labelledby="priorities-label" className="rounded-[10px] border border-line bg-paper-raised p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="priorities-label" className="text-sm font-semibold text-ink">Your priorities</h2>
        {!!preferences.length && <button type="button" onClick={() => { onChange([]); setEditing(null); }} className="min-h-9 text-xs font-medium text-clay-dark underline underline-offset-4">Clear filters</button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {preferences.map((preference) => <span key={preference.id} className="inline-flex items-center rounded-md border border-line bg-chip text-xs">
          <button type="button" onClick={() => setEditing(preference.id.startsWith("amenity-") ? "amenities" : preference.id === "budget-verified" ? "budget" : preference.id)} className="min-h-8 px-2.5 text-ink hover:bg-clay-tint">{preference.label}</button>
          <button type="button" aria-label={`Remove ${preference.label}`} onClick={() => update(preference.id, null)} className="min-h-8 px-2 text-ink-soft hover:text-clay-dark">×</button>
        </span>)}
        <div className="relative">
          <button type="button" aria-expanded={editing === "add"} onClick={() => setEditing(editing === "add" ? null : "add")} className="min-h-8 rounded-md border border-dashed border-line px-2.5 text-xs font-medium text-clay-dark hover:bg-clay-tint">+ Add priority</button>
          {editing === "add" && <div className="absolute left-0 top-full z-20 mt-2 w-44 rounded-lg border border-line bg-paper-raised p-1 shadow-lg">
            {[['budget','Monthly budget'],['beds','Bedrooms'],['baths','Bathrooms'],['amenities','Amenities']].map(([id,label]) => <button key={id} type="button" onClick={() => { if(id === 'budget' && !budget) setBudget(1500); setEditing(id); }} className="block min-h-10 w-full rounded px-3 text-left text-sm hover:bg-chip">{label}</button>)}
          </div>}
        </div>
      </div>
      {editing && editing !== "add" && <div className="mt-3 max-w-md rounded-md border border-line bg-paper p-3">
        <div className="mb-3 flex justify-between gap-4"><span className="text-xs font-semibold">{editing === "budget" ? "Monthly budget" : editing === "beds" ? "Bedrooms" : editing === "baths" ? "Bathrooms" : "Amenities"}</span><button type="button" onClick={() => setEditing(null)} className="text-xs font-semibold text-clay-dark">Done</button></div>
      <div className="grid gap-3">
        {editing === "budget" && <div>
          <label className="flex items-center justify-between gap-2 text-xs font-medium"><span className="flex items-center gap-2"><input type="checkbox" checked={budget !== null} onChange={(event) => event.target.checked ? setBudget(1500) : update("budget", null)} className="accent-clay" />Maximum monthly rent</span><span className="tabular-nums">{budget ? formatUsd(budget) : "Any price"}</span></label>
          <label className="mt-3 flex items-center justify-between gap-3 text-xs">Maximum rent ($)<input aria-label="Monthly budget amount" type="number" min="500" max="5000" step="50" value={budget ?? ""} onChange={(event) => { const value=Number(event.target.value); if(value>0) setBudget(value); }} className="w-24 rounded border border-line bg-paper-raised px-2 py-1.5 text-sm tabular-nums" /></label>
          <input aria-label="Maximum monthly rent" type="range" min="500" max="5000" step="50" value={budget ?? 1500} disabled={budget === null} onChange={(event) => setBudget(Number(event.target.value))} className="mt-4 w-full accent-clay disabled:opacity-30" />
          <select aria-label="Rent price basis" value={basis} disabled={budget === null} onChange={(event) => setBudget(budget ?? 1500, event.target.value)} className="mt-1 rounded border border-line bg-paper p-1 text-xs disabled:opacity-50"><option value="person">Per person / month</option><option value="unit">Per apartment / month</option></select>
          <label className="mt-3 flex items-start gap-2 text-xs text-ink-soft"><input type="checkbox" checked={!preferences.some((p) => p.id === "budget-verified")} onChange={(event) => update("budget-verified", event.target.checked ? null : "Confirmed rent only")} className="mt-0.5 accent-clay" />Include apartments with unconfirmed rent or price basis</label>
        </div>}
        {editing === "beds" && <label className="text-xs font-medium">Bedrooms<select className={selectClass} value={preferences.find((p) => p.id === "beds")?.label.match(/\d+/)?.[0] ?? ""} onChange={(event) => update("beds", event.target.value ? `${event.target.value} bedrooms` : null)}><option value="">Any</option>{[1,2,3,4,5,10].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
        {editing === "baths" && <label className="text-xs font-medium">Bathrooms<select className={selectClass} value={preferences.find((p) => p.id === "baths")?.label.match(/[\d.]+/)?.[0] ?? ""} onChange={(event) => update("baths", event.target.value ? `${event.target.value}+ bathrooms` : null)}><option value="">Any</option>{[1,1.5,2,2.5,3,4,5,10].map((n) => <option key={n} value={n}>{n}+</option>)}</select></label>}
      </div>
      {editing === "amenities" && <fieldset><legend className="mb-2 text-xs font-medium">Must-have amenities</legend><div className="flex flex-wrap gap-2">{AMENITIES.map((amenity) => {
        const selected = preferences.some((p) => p.id === `amenity-${amenity.id}`);
        return <button key={amenity.id} type="button" aria-pressed={selected} onClick={() => update(`amenity-${amenity.id}`, selected ? null : amenity.label)} className={`min-h-9 rounded-md border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-clay ${selected ? "border-clay bg-clay-tint text-clay-dark" : "border-line bg-paper text-ink hover:bg-chip"}`}>{amenity.label}</button>;
      })}</div></fieldset>}
      </div>}
    </section>
  );
}
