import type { ApartmentProfile } from "./types";
import type { CuratedFee } from "@/lib/curated-types";
import { formatUsd } from "./costs";

function feeAmount(fee: CuratedFee) {
  if (fee.rate !== null) return `${Number((fee.rate * 100).toFixed(2))}%`;
  if (fee.min !== null && fee.max !== null) return `${formatUsd(fee.min)}–${formatUsd(fee.max)}`;
  if (fee.amount !== null) return formatUsd(fee.amount);
  return fee.estimate !== null ? `Varies · ${formatUsd(fee.estimate)} source estimate` : "Variable / not specified";
}

/** Full source schedule; optional or conditional amounts never enter required totals. */
export function CuratedDetails({ profile }: { profile: ApartmentProfile }) {
  const data = profile.curated;
  if (!data) return null;
  const plan = profile.floorplans[0]?.curated;
  const groups = [
    ["Required charges", data.fees.filter((fee) => fee.requirement === "required")],
    ["Conditional charges & alternatives", data.fees.filter((fee) => /conditional/.test(fee.requirement))],
    ["Optional add-ons", data.fees.filter((fee) => fee.requirement === "optional")],
    ["Situational charges", data.fees.filter((fee) => fee.requirement === "situational")],
  ] as const;
  return <div className="mt-4 space-y-4 text-xs leading-relaxed text-ink">
    <div>
      <dl className="space-y-1">
        {(data.leaseStart || data.leaseEnd) && <div><dt className="inline font-medium">Lease: </dt><dd className="inline">{data.leaseStart ?? "Start not specified"} to {data.leaseEnd ?? "End not specified"}</dd></div>}
        {!data.leaseStart && data.leaseNotes && <div><dt className="inline font-medium">Lease: </dt><dd className="inline">{data.leaseNotes}</dd></div>}
        {!!data.installments && <div><dt className="inline font-medium">Payments: </dt><dd className="inline">{data.installments} installments</dd></div>}
        {data.utilities && <div><dt className="inline font-medium">Utilities: </dt><dd className="inline">{data.utilities}</dd></div>}
        {plan?.reportedTotal !== null && plan?.reportedTotal !== undefined && <div><dt className="inline font-medium">Advertised leasing price: </dt><dd className="inline">{formatUsd(plan.reportedTotal)}{plan.reportedTotalMax !== null ? `–${formatUsd(plan.reportedTotalMax)}` : ""} / {plan.cadence === "per installment" ? "installment" : "month"}<span className="block text-ink-soft">This is the source’s advertised figure; utilities and other charges may be additional.</span></dd></div>}
      </dl>
    </div>
    {(plan?.eligibility || plan?.occupancy || plan?.promotion) && <div className="space-y-1">
      {plan.occupancy && <p><strong>Room type:</strong> {plan.occupancy}</p>}
      {plan.eligibility && <p><strong>Eligibility:</strong> {plan.eligibility}</p>}
      {plan.promotion && <p className="text-clay-dark"><strong>Promotion conditions:</strong> {plan.promotion}</p>}
    </div>}
    {groups.map(([title, fees]) => fees.length ? <details key={title} className="border-t border-line pt-3">
      <summary className="min-h-8 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-clay">{title} ({fees.length})</summary>
      <ul className="divide-y divide-line">{fees.map((fee) => <li key={fee.id} className="py-3">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="font-medium">{fee.name}</span><strong className="tabular-nums">{feeAmount(fee)}</strong></div>
        <p className="mt-1 text-ink-soft">{fee.cadence === "unconfirmed" ? "Frequency unconfirmed" : fee.cadence}{fee.scope !== "all plans" && ` · ${fee.scope}`}</p>
        <p className="mt-1 text-ink-soft">{fee.condition}</p>
      </li>)}</ul>
    </details> : null)}
    {!!data.notes.length && <details className="border-t border-line pt-3"><summary className="min-h-8 cursor-pointer font-semibold">Source notes & conditions</summary><ul className="mt-2 list-disc space-y-2 pl-4 text-ink-soft">{data.notes.map((note, i) => <li key={i}>{note}</li>)}</ul></details>}
    {plan?.features && <p className="whitespace-pre-line text-ink-soft">{plan.features}</p>}
    {plan?.imageUrl && /^https:\/\//.test(plan.imageUrl) && <details className="border-t border-line pt-3"><summary className="min-h-8 cursor-pointer font-semibold">Floor-plan diagram</summary>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plan.imageUrl} alt={`${plan.name} floor-plan diagram`} loading="lazy" referrerPolicy="no-referrer" className="mt-3 max-h-80 w-full rounded bg-white object-contain" />
    </details>}
  </div>;
}
