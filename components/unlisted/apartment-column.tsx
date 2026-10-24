"use client";

import type { ReactNode } from "react";
import { formatUsd, summarizeCosts } from "./costs";
import { FeeBreakdown } from "./fee-breakdown";
import { Bed, Calendar, Close, Heart, Receipt, Sparkle, Tag, Walk } from "./icons";
import { ListingPhoto } from "./listing-photo";
import type { ComparisonApartment } from "./types";

export type AttributeRow = "campus" | "floorplan" | "amenities" | "lease" | "extras";

export const ATTRIBUTE_ROWS: AttributeRow[] = ["campus", "floorplan", "amenities", "lease", "extras"];

/** Rows outside the attribute list: photo, name, price, fee breakdown. */
export const FIXED_ROW_COUNT = 4;

export type Highlight = "Shortest walk" | "Lowest rent" | "Most amenities" | "Lowest monthly total";

const HIGHLIGHT_ICONS: Record<Highlight, ReactNode> = {
  "Shortest walk": <Walk size={14} />,
  "Lowest rent": <Tag size={14} />,
  "Most amenities": <Sparkle size={14} />,
  "Lowest monthly total": <Receipt size={14} />,
};

function extraCostLines(apartment: ComparisonApartment): string[] {
  return summarizeCosts(apartment).monthlyFees.map((fee) => {
    if (fee.amount === null) return `${fee.name} extra · price not listed`;
    const prefix = fee.basis === "estimated" ? "~" : "";
    const note = fee.basis === "estimated" ? `sample ${fee.name.toLowerCase()}` : fee.name.toLowerCase();
    return `${prefix}${formatUsd(fee.amount)} / mo ${note}`;
  });
}

export function attributeValue(apartment: ComparisonApartment, row: AttributeRow): string {
  switch (row) {
    case "campus":
      return apartment.walking ? `${apartment.walking.formattedDuration} walk · ${apartment.walking.formattedDistance}` : "";
    case "floorplan":
      return `${apartment.floorPlan.beds ?? "?"} bed · ${apartment.floorPlan.baths ?? "?"} bath ${apartment.floorPlan.note ?? ""}`;
    case "amenities":
      return apartment.amenities.join(" · ");
    case "lease":
      return `${apartment.lease.months ?? ""} ${apartment.lease.type ?? ""} ${apartment.lease.dates ?? ""}`;
    case "extras":
      return extraCostLines(apartment).join("\n");
  }
}

const ROW_META: Record<AttributeRow, { label: string; icon: ReactNode }> = {
  campus: { label: "To campus", icon: <Walk size={15} /> },
  floorplan: { label: "Floor plan", icon: <Bed size={15} /> },
  amenities: { label: "Amenities", icon: <Sparkle size={15} /> },
  lease: { label: "Lease terms", icon: <Calendar size={15} /> },
  extras: { label: "Extra costs", icon: <Receipt size={15} /> },
};

function AttributeContent({ apartment, row }: { apartment: ComparisonApartment; row: AttributeRow }) {
  const notListed = <span className="text-ink-soft italic">Not listed</span>;
  switch (row) {
    case "campus":
      return apartment.walking ? (
        <>
          {apartment.walking.formattedDuration} walk · {apartment.walking.formattedDistance} to UT Tower
          {apartment.cycling && <span className="block text-ink-soft">{apartment.cycling.formattedDuration} by bike</span>}
        </>
      ) : (
        notListed
      );
    case "floorplan":
      return (
        <>
          {apartment.floorPlan.beds ?? "?"} bed · {apartment.floorPlan.baths ?? "?"} bath
          {apartment.floorPlan.note && <span className="block">{apartment.floorPlan.note}</span>}
        </>
      );
    case "amenities":
      return apartment.amenities.length > 0 ? apartment.amenities.join(" · ") : notListed;
    case "lease":
      return apartment.lease.months ? (
        <>
          {apartment.lease.months} months{apartment.lease.type && ` · ${apartment.lease.type}`}
          {apartment.lease.dates && <span className="block">{apartment.lease.dates}</span>}
        </>
      ) : (
        notListed
      );
    case "extras": {
      const lines = extraCostLines(apartment);
      return lines.length > 0 ? lines.map((line) => <span key={line} className="block">{line}</span>) : "None listed";
    }
  }
}

type ApartmentColumnProps = {
  apartment: ComparisonApartment;
  rows: AttributeRow[];
  highlight: Highlight | null;
  budget: number | null;
  saved: boolean;
  onToggleSaved: () => void;
  onRemove: () => void;
  className?: string;
};

/**
 * One comparison column. It spans the parent's subgrid rows so each attribute
 * lines up horizontally with the same attribute on the other apartments.
 */
export function ApartmentColumn({ apartment, rows, highlight, budget, saved, onToggleSaved, onRemove, className = "" }: ApartmentColumnProps) {
  const overBudget = budget !== null && apartment.advertisedRent !== null && apartment.advertisedRent > budget;

  return (
    <article
      aria-labelledby={`apt-${apartment.id}`}
      style={{ gridRow: `span ${FIXED_ROW_COUNT + rows.length}` }}
      className={`grid grid-rows-subgrid gap-0 overflow-hidden rounded-[10px] border border-line bg-paper-raised ${className}`}
    >
      <div className="relative h-[152px] bg-sage">
        <ListingPhoto tone={apartment.photoTone} name={apartment.name} />
        {apartment.isSample && (
          <span className="absolute top-3 left-2.5 rounded-[3px] bg-paper-raised px-1.5 py-[3px] text-[9.5px] leading-none tracking-[0.04em] text-ink-soft uppercase">
            Illustrative listing
          </span>
        )}
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          <button
            type="button"
            onClick={onToggleSaved}
            aria-pressed={saved}
            aria-label={saved ? `Unsave ${apartment.name}` : `Save ${apartment.name}`}
            className={`grid h-[23px] w-[23px] place-items-center rounded-full bg-paper-raised hover:bg-chip ${saved ? "text-clay" : "text-ink-soft"}`}
          >
            <Heart size={13} filled={saved} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${apartment.name} from comparison`}
            className="grid h-[23px] w-[23px] place-items-center rounded-full bg-paper-raised text-ink-soft hover:bg-chip hover:text-ink"
          >
            <Close size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        <h3 id={`apt-${apartment.id}`} className="text-[20px] leading-tight text-ink">
          {apartment.name}
        </h3>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          {apartment.street} · {apartment.neighborhood}
        </p>
      </div>

      <div className="border-b border-line px-4 pt-3.5 pb-3">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[26px] leading-none tabular-nums">
            {apartment.advertisedRent === null ? "—" : formatUsd(apartment.advertisedRent)}
          </span>
          <span className="text-[11px] text-ink-soft">/ {apartment.rentBasis.replace("per ", "")} / mo</span>
        </p>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
          {highlight && (
            <span className="flex items-center gap-1 font-semibold text-clay-dark">
              <span className="text-clay">{HIGHLIGHT_ICONS[highlight]}</span>
              {highlight}
            </span>
          )}
          {highlight && apartment.isSample && <span className="text-ink-soft">·</span>}
          {apartment.isSample && <span className="text-ink-soft">Sample price</span>}
          {overBudget && <span className="w-full font-medium text-clay-dark">Over your {formatUsd(budget)} budget</span>}
        </p>
      </div>

      {rows.map((row, index) => (
        <dl key={row} className={`m-0 grid grid-cols-[6.25rem_1fr] gap-2 px-4 text-[12.5px] leading-[1.25] ${index === 0 ? "pt-2" : "pt-2.5"}`}>
          <dt className="flex items-start gap-1.5 text-ink-soft">
            <span className="shrink-0">{ROW_META[row].icon}</span>
            {ROW_META[row].label}
          </dt>
          <dd className="text-ink">
            <AttributeContent apartment={apartment} row={row} />
          </dd>
        </dl>
      ))}

      <div className="px-4 pt-3 pb-4">
        <FeeBreakdown apartment={apartment} />
      </div>
    </article>
  );
}
