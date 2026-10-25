"use client";
import { useState } from "react";
import { ApartmentReviews, RatingStars } from "./apartment-reviews";
import { FeeBreakdown } from "./fee-breakdown";
import { ListingPhoto } from "./listing-photo";
import { formatUsd, toComparisonApartment } from "./costs";
import type { ComparisonApartment } from "./types";

function leaseTerms(apartment: ComparisonApartment) {
  const parts = [
    apartment.lease.months === null ? "" : `${apartment.lease.months} months`,
    apartment.lease.type ?? "",
    apartment.lease.dates ?? "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Confirm lease dates and terms with the property.";
}

export function ApartmentDetail({ apartment: original, onBack, onRetry }: { apartment: ComparisonApartment; onBack: () => void; onRetry: () => void }) {
  const [planIndex, setPlanIndex] = useState(0);
  const profile = original.profile;
  const selectedPlan = profile?.floorplans[planIndex];
  const apartment = selectedPlan && profile ? { ...original, ...toComparisonApartment({ ...profile, floorplans: [selectedPlan] }) } : original;
  const loading = original.researchStatus === "loading";
  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center rounded-md border border-line bg-paper-raised px-4 text-sm font-semibold text-ink hover:bg-chip">Back to all apartments</button>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{apartment.name}</h1><p className="mt-2 text-sm text-ink-soft">{apartment.street} · {apartment.neighborhood}</p></div><div className="text-right"><RatingStars rating={apartment.honestRating} size={22} /><p className="mt-1 text-sm">{apartment.honestRating?.toFixed(1) ?? "No score yet"}{apartment.honestRating !== null && " / 5 resident score"}</p></div></div>
    <div className="h-64 overflow-hidden rounded-xl border border-line sm:h-96"><ListingPhoto key={apartment.databaseId ?? apartment.id} name={apartment.name} databaseId={apartment.databaseId} gallery /></div>
    {loading && <p role="status" className="rounded-lg bg-stone-200 p-4 text-sm font-medium">Researching this apartment’s pricing, reviews, and commute…</p>}
    {original.researchStatus === "error" && <div role="alert" className="rounded-lg bg-clay-tint p-4 text-sm"><p>{original.researchError}</p><button type="button" onClick={onRetry} className="mt-2 min-h-10 rounded-md border border-clay px-3 font-semibold text-clay-dark">Retry research</button></div>}
    <div inert={loading} className={`grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${loading ? "pointer-events-none opacity-40 grayscale" : ""}`}>
      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-paper-raised p-5 sm:p-6" aria-labelledby="detail-pricing">
          <h2 id="detail-pricing" className="text-xl font-semibold">Pricing & fees</h2>
          {!!profile?.floorplans.length && <label className="mt-4 block text-sm font-medium">Floor plan<select value={planIndex} onChange={(event) => setPlanIndex(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-md border border-line bg-paper px-3">{profile.floorplans.map((plan, index) => <option key={index} value={index}>{plan.name ?? `Plan ${index + 1}`} · {plan.beds ?? "?"} bed · {plan.baths ?? "?"} bath</option>)}</select></label>}
          <p className="mt-5 text-3xl font-semibold tabular-nums">{apartment.advertisedRent === null ? "Rent not published" : formatUsd(apartment.advertisedRent)}</p><p className="mt-1 text-sm text-ink-soft">Monthly base rent · {apartment.rentBasis}</p>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">Sourced listing information may be outdated or promotional. Confirm availability, lease dates, and required charges with the property.</p>
          {apartment.rentSourceUrl && /^https?:\/\//i.test(apartment.rentSourceUrl) && <a href={apartment.rentSourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-clay-dark underline underline-offset-4">Check the listed price</a>}
          <div className="mt-5 [&_section]:text-sm [&_dt]:text-sm [&_dd]:text-sm"><FeeBreakdown key={planIndex} apartment={apartment} defaultOpen /></div>
        </section>
        <section className="rounded-xl border border-line bg-paper-raised p-5 sm:p-6" aria-labelledby="detail-property"><h2 id="detail-property" className="text-xl font-semibold">The property</h2><dl className="mt-4 space-y-4 text-sm leading-relaxed"><div><dt className="font-semibold">Floor plan</dt><dd className="mt-1 text-ink-soft">{apartment.floorPlan.beds ?? "?"} beds · {apartment.floorPlan.baths ?? "?"} baths{selectedPlan?.sqft !== null && selectedPlan?.sqft !== undefined && ` · ${selectedPlan.sqft} sq ft`}</dd></div><div><dt className="font-semibold">Amenities</dt><dd className="mt-1 text-ink-soft">{apartment.amenities.length ? apartment.amenities.join(" · ") : "Not disclosed in the available sources"}</dd></div><div><dt className="font-semibold">Commute to UT Tower</dt><dd className="mt-1 text-ink-soft">Walk: {apartment.walking ? `${apartment.walking.formattedDuration} · ${apartment.walking.formattedDistance}` : "Unavailable"}<br />Bike: {apartment.cycling ? `${apartment.cycling.formattedDuration} · ${apartment.cycling.formattedDistance}` : "Unavailable"}</dd></div><div><dt className="font-semibold">Lease terms</dt><dd className="mt-1 text-ink-soft">{leaseTerms(apartment)}</dd></div></dl>
          {profile?.website && /^https?:\/\//i.test(profile.website) && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-clay-dark underline underline-offset-4">Visit the property website</a>}
        </section>
      </div>
      <section className="rounded-xl border border-line bg-paper-raised p-5 sm:p-6 [&_p]:text-sm" aria-labelledby="detail-reviews"><h2 id="detail-reviews" className="mb-5 text-xl font-semibold">Reviews & resident experience</h2><ApartmentReviews apartment={apartment} /></section>
    </div>
  </div>;
}
