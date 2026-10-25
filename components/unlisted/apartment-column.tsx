"use client";

import { useState, type ReactNode } from "react";
import { formatUsd, summarizeCosts, toComparisonApartment } from "./costs";
import { FeeBreakdown } from "./fee-breakdown";
import { Bed, Calendar, ChevronDown, Close, Heart, Receipt, Sparkle, Tag, Walk } from "./icons";
import { ApartmentReviews, RatingStars } from "./apartment-reviews";
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
  onRefresh: () => void;
  onOpen?: () => void;
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
export function ApartmentColumn({ onOpen, onRefresh, apartment: original, rows, highlight, budget, saved, onToggleSaved, onRemove, className = "" }: ApartmentColumnProps) {
  const [planIndex, setPlanIndex] = useState(0);
  const profile = original.profile;
  const selectedPlan = profile?.floorplans[planIndex];
  const apartment = profile && selectedPlan ? { ...original, ...toComparisonApartment({ ...profile, floorplans: [selectedPlan] }), databaseId: original.databaseId, researchStatus: original.researchStatus, researchError: original.researchError } : original;
  const costs = summarizeCosts(apartment);
  const basicRows = rows.filter((row) => row === "campus" || row === "floorplan");
  const overBudget = budget !== null && apartment.rentBasis === "per person" && apartment.advertisedRent !== null && apartment.advertisedRent > budget;

  return (
    <article
      aria-labelledby={`apt-${apartment.id}`}
      aria-busy={apartment.researchStatus === "loading"}
      onClick={onOpen ? (event) => { if (!(event.target as HTMLElement).closest("button,a,summary,input,select,textarea,label")) onOpen(); } : undefined}
      className={`relative flex flex-col self-start overflow-hidden rounded-[10px] border border-line bg-paper-raised ${onOpen ? "cursor-pointer" : ""} ${className}`}
    >
      {apartment.researchStatus === "loading" && (
        <div onClick={(event) => event.stopPropagation()} className="absolute inset-0 z-20 flex items-start justify-center bg-stone-200/80 px-3 pt-6">
          <div className="sticky top-6 w-full max-w-[320px] overflow-hidden rounded-lg bg-[#f6f2e9]">
            <iframe title="Squirrel building an apartment" src="/animations/squirrel-builder.html?embed" className="aspect-[32/23] w-full border-0" />
            <div role="status" className="px-4 pb-5 text-center text-sm font-semibold text-ink">Researching apartment details…<span className="mt-1 block text-xs font-normal text-ink-soft">Checking pricing, fees, reviews, and commute.</span></div>
          </div>
        </div>
      )}
      <div inert={apartment.researchStatus === "loading"} className={`flex flex-col ${apartment.researchStatus === "loading" ? "grayscale opacity-40" : ""}`}>
      <div className="relative h-[152px] bg-sage">
        <ListingPhoto key={apartment.databaseId ?? apartment.id} tone={apartment.photoTone} name={apartment.name} databaseId={apartment.databaseId} />
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
          {onOpen ? <button type="button" onClick={onOpen} className="text-left hover:underline underline-offset-4" aria-label={`View details for ${apartment.name}`}>{apartment.name}<span className="mt-1 block text-xs font-normal text-clay-dark">View full details</span></button> : apartment.name}
        </h3>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          {apartment.street} · {apartment.neighborhood}
        </p>
      </div>

      <div className="border-b border-line px-4 pt-3.5 pb-3">
        {!!profile && profile.floorplans.length > 1 && <label className="mb-3 block text-xs font-medium">Floor plan<select value={planIndex} onChange={(event) => setPlanIndex(Number(event.target.value))} className="mt-1 min-h-10 w-full rounded-md border border-line bg-paper px-2 text-sm">{profile.floorplans.map((plan, index) => <option key={index} value={index}>{plan.name ?? `Plan ${index + 1}`} · {plan.beds ?? "?"} bed · {plan.baseRent === null ? "Rent not listed" : formatUsd(plan.baseRent)}</option>)}</select></label>}
        <p className="mb-2 text-xs text-ink-soft">Listed base rent</p>
        <p className="flex items-baseline gap-1.5">
          <span className="text-[26px] leading-none tabular-nums">
            {apartment.advertisedRent === null ? "—" : formatUsd(apartment.advertisedRent)}
          </span>
          <span className="text-[11px] text-ink-soft">{apartment.rentBasis === "basis unknown" ? "/ mo · price basis unconfirmed" : `/ ${apartment.rentBasis.replace("per ", "")} / mo`}</span>
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

      {basicRows.map((row, index) => (
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

      <div className="mx-4 mt-4 flex items-center justify-between gap-3 border-t border-line py-3 text-xs">
        <span className="flex flex-col gap-1.5 font-medium text-ink">Resident score<RatingStars rating={apartment.honestRating} /></span>
        <span className="font-semibold tabular-nums text-ink">{apartment.honestRating === null ? "Not enough reviews" : `${apartment.honestRating.toFixed(1)} / 5`}</span>
      </div>
      <div className="mx-4 mb-4 rounded-lg bg-sage/50 px-3 py-2.5 text-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-ink">{(costs.monthlyUnknownCount || costs.unclassifiedFees.length || !apartment.fees.length) ? "Known monthly subtotal" : costs.monthlyHasEstimate ? "Estimated monthly cost" : "Monthly cost"}</span>
          <strong className="text-[16px] tabular-nums text-ink">{costs.monthlyTotal === null ? "Not available" : `${costs.monthlyHasEstimate ? "~" : ""}${formatUsd(costs.monthlyTotal)}`}</strong>
        </div>
        <p className="mt-1 leading-relaxed text-ink-soft">{costs.monthlyUnknownCount ? `${costs.monthlyUnknownCount} monthly fee${costs.monthlyUnknownCount === 1 ? "" : "s"} still undisclosed. Total may be higher.` : `Known amounts only · ${apartment.rentBasis}. Additional fees may apply.`}</p>
      </div>
      {apartment.researchStatus === "error" && <div className="px-4 pb-3 text-xs"><p role="alert" className="text-clay-dark">{apartment.researchError}</p><button type="button" onClick={onRefresh} className="mt-2 min-h-10 rounded-md border border-line px-3 font-semibold">Retry research</button></div>}
      <div className="border-t border-line">
        <ModuleDetails title="Pricing breakdown" subtitle={`${apartment.fees.length} listed fees`}>
          <p className="mb-3 text-xs leading-relaxed text-ink-soft">Prices come from search snippets, which may be outdated or promotional. They are not a verified quote for your lease dates.{apartment.fetchedAt && ` Researched ${new Date(apartment.fetchedAt).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}.`}</p>
          {apartment.rentSourceUrl && /^https?:\/\//i.test(apartment.rentSourceUrl) && <a href={apartment.rentSourceUrl} target="_blank" rel="noopener noreferrer" className="mb-3 inline-block text-xs text-clay-dark underline underline-offset-4">Check the price source</a>}
          <FeeBreakdown apartment={apartment} defaultOpen />
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">Unknown charges are excluded from the totals. Confirm required fees and deposits with the property before signing.</p>
        </ModuleDetails>
        <ModuleDetails title="Reviews & resident experience" subtitle={`${apartment.honestCount} resident reviews`}>
          <ApartmentReviews apartment={apartment} />
        </ModuleDetails>
        <ModuleDetails title="Amenities & lease details" subtitle="The everyday essentials">
          <dl className="space-y-4 text-[13px] leading-relaxed">
            {(["amenities", "lease"] as AttributeRow[]).filter((row) => rows.includes(row)).map((row) => <div key={row}><dt className="mb-1 font-semibold">{ROW_META[row].label}</dt><dd><AttributeContent apartment={apartment} row={row} /></dd></div>)}
            {apartment.cycling && <div><dt className="mb-1 font-semibold">Bike to UT Tower</dt><dd>{apartment.cycling.formattedDuration} · {apartment.cycling.formattedDistance}</dd></div>}
          </dl>
          {!!apartment.sources?.length && <div className="mt-4 border-t border-line pt-3"><p className="text-xs font-semibold">Listing sources</p>{apartment.sources.filter((url) => /^https?:\/\//i.test(url) && !/[?&]api_key=/i.test(url)).map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-xs text-clay-dark underline underline-offset-4">Source {index + 1}: {new URL(url).hostname}</a>)}</div>}
        </ModuleDetails>
      </div>
      </div>
    </article>
  );
}

function ModuleDetails({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <details className="group/module border-b border-line last:border-b-0">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-clay [&::-webkit-details-marker]:hidden">
        <span><span className="block text-[13px] font-semibold text-ink">{title}</span><span className="mt-1 block text-xs text-ink-soft">{subtitle}</span></span>
        <ChevronDown size={16} className="shrink-0 text-ink-soft transition-transform group-open/module:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="px-4 pb-4 text-ink">{children}</div>
    </details>
  );
}
