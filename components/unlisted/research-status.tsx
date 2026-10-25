"use client";

export function ResearchStatus({ compact = false }: { compact?: boolean }) {
  return <div role="status" className={compact
    ? "rounded-lg bg-stone-800 px-4 py-3 text-center text-sm font-semibold leading-relaxed text-white"
    : "rounded-lg bg-stone-200 p-4 text-sm font-medium"}>
    Researching pricing, reviews, and commute…
  </div>;
}
