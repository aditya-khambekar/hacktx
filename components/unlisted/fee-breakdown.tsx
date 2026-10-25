"use client";

import { useId, useState, type ReactNode } from "react";
import { formatUsd, rentPeriod, summarizeCosts } from "./costs";
import { ChevronDown } from "./icons";
import type { ComparisonApartment, Fee } from "./types";

export function SamplePill({ children = "Sample / unverified" }: { children?: ReactNode }) {
  return <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] whitespace-nowrap text-ink-soft">{children}</span>;
}

function Row({ label, value, strong = false }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-[2.5px] ${strong ? "font-semibold text-ink" : ""}`}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd className="shrink-0 text-right font-semibold whitespace-nowrap text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function feeValue(fee: Fee, cadence: string | null) {
  if (fee.amount === null) return <span className="font-normal text-ink-soft">{fee.cadence === "monthly" ? "Extra · not listed" : "Not disclosed"}</span>;
  return (
    <>
      {fee.basis === "estimated" && <span aria-label="estimated">~</span>}
      {formatUsd(fee.amount)}
      {cadence && ` ${cadence}`}
    </>
  );
}

function feeLabel(fee: Fee) {
  return (
    <>
      {fee.name}
      {fee.basis === "estimated" && " estimate"}
      {fee.refundable && <span className="text-[10.5px]"> (refundable)</span>}
    </>
  );
}

function GroupHeading({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "clay" }) {
  return (
    <h5 className={`pt-2 pb-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase ${tone === "clay" ? "text-clay-dark" : "text-ink-soft"}`}>
      {children}
    </h5>
  );
}

type FeeBreakdownProps = {
  apartment: ComparisonApartment;
  /** Pass null when the surrounding card already has a heading. */
  title?: string | null;
  defaultOpen?: boolean;
};

/**
 * Advertised rent, the monthly fees on top of it, and one-time charges, each
 * with its own total. One-time charges are never added to the monthly figure.
 * Collapsed, it shows only the totals; the toggle reveals every fee.
 */
export function FeeBreakdown({ apartment, title = "Fee breakdown", defaultOpen = false }: FeeBreakdownProps) {
  const [open, setOpen] = useState(defaultOpen);
  const detailsId = useId();
  const costs = summarizeCosts(apartment);
  const period = rentPeriod(apartment);
  const monthlyTotal =
    costs.monthlyTotal === null ? "Unknown" : `${costs.monthlyHasEstimate ? "~" : ""}${formatUsd(costs.monthlyTotal)} ${period}`;
  const moveInTotal = costs.oneTimeFees.length === 0 ? "Not listed" : `${formatUsd(costs.oneTimeTotal)}${costs.oneTimeUnknownCount > 0 ? " + unknown" : ""}`;
  const monthlyFeeSum = costs.monthlyTotal === null || costs.rent === null ? null : costs.monthlyTotal - costs.rent;
  const feeCount = apartment.fees.length;
  const rent = apartment.advertisedRent === null ? "Not published" : `${formatUsd(apartment.advertisedRent)} ${period}`;

  return (
    <section
      aria-label={`${title ?? "Fee breakdown"} for ${apartment.name}`}
      className="rounded-lg border border-line bg-paper px-3 pt-2.5 text-[12px]"
    >
      {title && (
        <div className="flex items-center justify-between gap-2 pb-1">
          <h4 className="text-[12px] font-semibold text-ink">{title}</h4>
          {apartment.isSample && <SamplePill />}
        </div>
      )}

      {open ? (
        <div id={detailsId}>
          <dl className="pt-1">
            <Row label="Base rent (advertised)" value={rent} />
          </dl>

          <GroupHeading>+ Required recurring fees</GroupHeading>
          <dl>
            {costs.monthlyFees.length === 0 && <Row label="None listed" value="" />}
            {costs.monthlyFees.map((fee) => (
              <Row key={fee.name} label={feeLabel(fee)} value={feeValue(fee, period)} />
            ))}
            <div className="mt-1 border-t border-line pt-1">
              <Row label={(costs.monthlyUnknownCount || costs.unclassifiedFees.length || !apartment.fees.length) ? "Known recurring subtotal" : costs.monthlyHasEstimate ? "Est. monthly total" : "Recurring subtotal"} value={monthlyTotal} strong />
            </div>
          </dl>

          <div className="mt-1 border-t border-dashed border-clay/40">
            <GroupHeading tone="clay">One-time charges · application / move-in</GroupHeading>
            <dl>
              {costs.oneTimeFees.length === 0 && <Row label="None listed" value="" />}
              {costs.oneTimeFees.map((fee) => (
                <Row key={fee.name} label={feeLabel(fee)} value={feeValue(fee, null)} />
              ))}
              <div className="mt-1 border-t border-line pt-1">
                <Row label="Known one-time charges" value={moveInTotal} strong />
              </div>
            </dl>
            {costs.oneTimeUnknownCount > 0 && (
              <p className="text-[10.5px] text-ink-soft">+ {costs.oneTimeUnknownCount} not disclosed · not part of monthly rent</p>
            )}
          </div>

          {!!costs.unclassifiedFees.length && <div className="mt-3 border-t border-line pt-2"><GroupHeading>Other required charges</GroupHeading><dl>{costs.unclassifiedFees.map((fee) => <Row key={fee.name} label={fee.name} value={feeValue(fee, null)} />)}</dl><p className="mt-1 text-xs text-ink-soft">Annual, usage-based and unclassified charges are excluded from the subtotals above.</p></div>}
        </div>
      ) : (
        <dl className="pt-1">
          <Row label="Base rent (advertised)" value={rent} />
          <Row
            label={`+ Recurring fees${costs.monthlyUnknownCount > 0 ? ` · ${costs.monthlyUnknownCount} not listed` : ""}`}
            value={monthlyFeeSum === null ? "Unknown" : `${costs.monthlyHasEstimate ? "~" : ""}${formatUsd(monthlyFeeSum)} ${period}`}
          />
          <div className="mt-1 border-t border-line pt-1">
            <Row label={(costs.monthlyUnknownCount || costs.unclassifiedFees.length || !apartment.fees.length) ? "Known recurring subtotal" : costs.monthlyHasEstimate ? "Est. monthly total" : "Recurring subtotal"} value={monthlyTotal} strong />
          </div>
          <div className="mt-1 border-t border-dashed border-clay/40 pt-1">
            <Row label={<span className="text-clay-dark">One-time charges</span>} value={moveInTotal} />
          </div>
        </dl>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? detailsId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="-mx-3 mt-1.5 flex w-[calc(100%+1.5rem)] items-center justify-between gap-2 rounded-b-lg border-t border-line px-3 py-2 text-[11.5px] font-semibold text-clay-dark hover:bg-chip"
      >
        {open ? "Hide fee details" : `Show all ${feeCount} fees`}
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </section>
  );
}
