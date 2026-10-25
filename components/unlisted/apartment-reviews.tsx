"use client";
import { useId, useState } from "react";
import { Star } from "./icons";
import { filterReviews, type ReviewFilter } from "./review-utils";
import type { ComparisonApartment } from "./types";

export function RatingStars({ rating, size = 18 }: { rating: number | null; size?: number }) {
  return <span className="inline-flex gap-0.5" role="img" aria-label={rating === null ? "No rating available" : `${rating.toFixed(1)} out of 5 stars`}>
    {Array.from({ length: 5 }, (_, index) => <span key={index} className="relative inline-block text-stone-300" style={{ width: size, height: size }}>
      <Star size={size} /><span className="absolute inset-y-0 left-0 overflow-hidden text-clay" style={{ width: `${Math.max(0, Math.min(1, (rating ?? 0) - index)) * 100}%` }}><Star size={size} /></span>
    </span>)}
  </span>;
}

export function ApartmentReviews({ apartment }: { apartment: ComparisonApartment }) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [keyword, setKeyword] = useState("");
  const id = useId();
  const reviews = apartment.reviews ?? [];
  const filtered = filterReviews(reviews, filter, keyword);
  return <div>
    <div className="flex flex-wrap items-center gap-3"><strong className="text-3xl tabular-nums">{apartment.honestRating?.toFixed(1) ?? "—"}</strong><div><RatingStars rating={apartment.honestRating} /><p className="mt-1 text-xs text-ink-soft">Resident score · {apartment.honestCount} reviews</p></div></div>
    <p className="mt-3 text-xs leading-relaxed text-ink-soft">{apartment.excludedTour} tour reviews excluded from this score. Google: {apartment.googleRating?.toFixed(1) ?? "Not available"}{apartment.googleReviewCount !== null && ` (${apartment.googleReviewCount} reviews)`}.{apartment.isSample && " Illustrative scores."}</p>
    {reviews.length ? <>
      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium" htmlFor={`${id}-filter`}>Show reviews</label>
        <select id={`${id}-filter`} value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilter)} className="min-h-10 w-full rounded-md border border-line bg-paper px-2 text-sm focus-visible:outline-2 focus-visible:outline-clay">
          <option value="all">All reviews</option><option value="critical">Critical · 1–2 stars</option><option value="positive">Positive · 4–5 stars</option>
        </select>
        <label className="block text-xs font-medium" htmlFor={`${id}-keyword`}>Find a keyword</label>
        <input id={`${id}-keyword`} type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="e.g. maintenance, noise, fees" className="min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm focus-visible:outline-2 focus-visible:outline-clay" />
      </div>
      <p className="mt-3 text-xs text-ink-soft" aria-live="polite">{filtered.length} of {reviews.length} fetched reviews · filters don’t change the overall score</p>
      <div className="mt-2 max-h-96 overflow-y-auto">
        {filtered.map((review) => <div key={review.id} className="border-t border-line py-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{review.author ?? "Anonymous reviewer"}</strong><RatingStars rating={review.rating} size={14} /></div>
          <p className="mt-2 text-ink-soft">{review.about === "apartment" ? "Resident review" : review.about === "tour" ? "Tour review · excluded from score" : "Unclassified · excluded from score"}</p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{review.text || "No review text available."}</p>
          {review.link && /^https?:\/\//i.test(review.link) && <a href={review.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-clay-dark underline underline-offset-4">Read original review</a>}
        </div>)}
        {!filtered.length && <p className="py-4 text-sm text-ink-soft">No fetched reviews match. Try another keyword or rating filter.</p>}
      </div>
    </> : <p className="mt-3 text-xs leading-relaxed text-ink-soft">Review text is not available for this listing yet.</p>}
  </div>;
}
