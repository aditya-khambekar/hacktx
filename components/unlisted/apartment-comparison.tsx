"use client";

import { useState, type ReactNode } from "react";
import { ATTRIBUTE_ROWS, ApartmentColumn, attributeValue, type Highlight } from "./apartment-column";
import { CampusMap } from "./campus-map";
import { summarizeCosts } from "./costs";
import { ChevronDown, Columns, MapIcon } from "./icons";
import type { ComparisonApartment } from "./types";

export type SortKey = "added" | "rent" | "monthly" | "walk";

export const SORT_LABELS: Record<SortKey, string> = {
  added: "Added order",
  rent: "Lowest rent",
  monthly: "Lowest monthly total",
  walk: "Shortest walk",
};

export function sortApartments(apartments: ComparisonApartment[], sort: SortKey) {
  const value = (apartment: ComparisonApartment) => {
    switch (sort) {
      case "monthly":
        return summarizeCosts(apartment).monthlyTotal ?? Infinity;
      case "walk":
        return apartment.walking?.durationSeconds ?? Infinity;
      case "rent":
        return apartment.advertisedRent ?? Infinity;
      default:
        return 0;
    }
  };
  return sort === "added" ? apartments : [...apartments].sort((a, b) => value(a) - value(b));
}

/** At most one label per apartment, only when there is something to compare against. */
function computeHighlights(apartments: ComparisonApartment[]) {
  const highlights = new Map<string, Highlight>();
  if (apartments.length < 2) return highlights;
  const pick = (label: Highlight, score: (apartment: ComparisonApartment) => number | null) => {
    let best: ComparisonApartment | null = null;
    for (const apartment of apartments) {
      const value = score(apartment);
      if (value === null) continue;
      const bestValue = best ? score(best) : null;
      if (bestValue === null || value < bestValue) best = apartment;
    }
    if (best && !highlights.has(best.id)) highlights.set(best.id, label);
  };
  pick("Shortest walk", (a) => a.walking?.durationSeconds ?? null);
  pick("Lowest rent", (a) => a.advertisedRent);
  pick("Most amenities", (a) => -a.amenities.length);
  pick("Lowest monthly total", (a) => summarizeCosts(a).monthlyTotal);
  return highlights;
}

type ApartmentComparisonProps = {
  onOpen: (id: string) => void;
  onRefresh: (apartment: ComparisonApartment) => void;
  apartments: ComparisonApartment[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  budget: number | null;
  savedIds: Set<string>;
  onToggleSaved: (id: string) => void;
  onRemove: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyState: ReactNode;
};

export function ApartmentComparison({
  onOpen,
  onRefresh,
  apartments,
  sort,
  onSortChange,
  budget,
  savedIds,
  onToggleSaved,
  onRemove,
  selectedId,
  onSelect,
  emptyState,
}: ApartmentComparisonProps) {
  const [mode, setMode] = useState<"compare" | "map">("compare");
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  const sorted = sortApartments(apartments, sort);
  const activeId = sorted.some((a) => a.id === selectedId) ? selectedId : (sorted[0]?.id ?? null);
  const highlights = computeHighlights(apartments);
  const canDiff = apartments.length > 1;
  const rows =
    onlyDifferences && canDiff
      ? ATTRIBUTE_ROWS.filter((row) => new Set(apartments.map((a) => attributeValue(a, row))).size > 1)
      : ATTRIBUTE_ROWS;

  return (
    <section aria-label="Apartment comparison" className="@container flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md bg-chip p-[3px]" role="group" aria-label="View">
          {(
            [
              ["compare", "Compare", <Columns key="c" size={16} />],
              ["map", "Map", <MapIcon key="m" size={16} />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={`flex h-[28px] items-center gap-2 rounded-[5px] px-3 text-[13px] transition-colors ${
                mode === id ? "bg-paper-raised font-semibold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-soft hover:text-ink"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft">
          {mode === "compare" && (
            <label className={`flex items-center gap-2 ${canDiff ? "cursor-pointer" : "opacity-50"}`}>
              <button
                type="button"
                role="switch"
                aria-checked={onlyDifferences && canDiff}
                disabled={!canDiff}
                onClick={() => setOnlyDifferences((value) => !value)}
                className={`relative h-[16px] w-[26px] rounded-full transition-colors ${onlyDifferences && canDiff ? "bg-clay" : "bg-toggle"}`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                    onlyDifferences && canDiff ? "translate-x-[10px]" : ""
                  }`}
                />
              </button>
              <span>Only differences</span>
            </label>
          )}
          <label className="relative flex items-center gap-1.5">
            <span>Sort:</span>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortKey)}
              className="cursor-pointer appearance-none rounded bg-transparent py-1 pr-5 pl-0.5 text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-clay"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-0" />
          </label>
        </div>
      </div>

      {mode === "map" ? (
        <CampusMap apartments={sorted} activeId={activeId} onSelect={onSelect} />
      ) : apartments.length === 0 ? (
        emptyState
      ) : (
        <>
          {/* Phones show one property at a time, picked here. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden" role="group" aria-label="Choose an apartment">
            {sorted.map((apartment) => (
              <button
                key={apartment.id}
                type="button"
                aria-pressed={apartment.id === activeId}
                onClick={() => onSelect(apartment.id)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium ${
                  apartment.id === activeId ? "border-clay-dark bg-clay-tint text-clay-dark" : "border-line bg-paper-raised text-ink-soft"
                }`}
              >
                {apartment.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 @min-[60rem]:grid-cols-3">
            {sorted.map((apartment) => (
              <ApartmentColumn
                key={apartment.id}
                apartment={apartment}
                onOpen={() => onOpen(apartment.id)}
                onRefresh={() => onRefresh(apartment)}
                rows={rows}
                highlight={highlights.get(apartment.id) ?? null}
                budget={budget}
                saved={savedIds.has(apartment.id)}
                onToggleSaved={() => onToggleSaved(apartment.id)}
                onRemove={() => onRemove(apartment.id)}
                className={apartment.id === activeId ? "" : "max-md:hidden"}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
