"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toComparisonApartment } from "./costs";
import { Close, Plus } from "./icons";
import type { ApartmentProfile, ComparisonApartment } from "./types";

type Candidate = { placeId: string; name: string; address: string | null; googleRating: number | null; googleReviewCount: number | null; mapsUrl: string };
type Props = { open: boolean; onClose: () => void; shortlistIds: Set<string>; onAdd: (apartment: ComparisonApartment) => void };

function requestError(status: number, action: string) {
  if (status === 401) return "Sign in from the homepage to search and save apartments.";
  if (status === 503) return "Apartment search is unavailable right now. Please try again later.";
  return `We couldn’t ${action}. Please try again.`;
}

export function AddApartmentDialog({ open, onClose, shortlistIds, onAdd }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [nextStart, setNextStart] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) controller.current?.abort();
  }, [open]);
  useEffect(() => () => controller.current?.abort(), []);

  const search = useCallback(async (searchQuery: string, start = 0) => {
    if (!searchQuery) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");
    if (!start) { setResults([]); setNextStart(null); setSearchedQuery(null); }
    try {
      const response = await fetch("/api/apartments/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery, start }), signal: request.signal });
      if (!response.ok) throw new Error(requestError(response.status, "search apartments"));
      const data = await response.json();
      if (request.signal.aborted) return;
      setResults((current) => [...new Map([...(start ? current : []), ...data.apartments].map((apartment: Candidate) => [apartment.placeId, apartment])).values()] as Candidate[]);
      setSearchedQuery(searchQuery);
      setNextStart(data.nextStart);
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : "Search failed. Please try again.");
    } finally { if (!request.signal.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open || saving || query.trim().length < 2) return;
    debounce.current = setTimeout(() => { void search(query.trim()); }, 450);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      controller.current?.abort();
    };
  }, [open, query, saving, search]);

  async function add(candidate: Candidate) {
    setSaving(candidate.placeId);
    setError("");
    const profile: ApartmentProfile = {
      placeId: candidate.placeId, name: candidate.name, address: candidate.address,
      mapsUrl: candidate.mapsUrl, website: null, phone: null, labels: [], fetchedAt: new Date().toISOString(),
      googleRating: candidate.googleRating, googleReviewCount: candidate.googleReviewCount,
      honestRating: null, honestCount: 0, excludedTour: 0, unclearCount: 0,
      campus: { destination: "UT Tower", endCoords: "30.2862,-97.7394", walking: null, cycling: null },
      floorplans: [], reviews: [], sources: [candidate.mapsUrl],
    };
    // Display immediately. The workspace owns research so closing this dialog
    // never cancels the work or strands the apartment in a loading state.
    onAdd({ ...toComparisonApartment(profile), researchStatus: "loading" });
    setSaving(null);
  }

  return (
    <dialog ref={ref} onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }} onClick={(event) => { if (event.target === ref.current && !saving) onClose(); }} aria-labelledby="add-apartment-title" className="m-auto max-h-[85dvh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-paper-raised p-0 text-ink shadow-2xl backdrop:bg-ink/40">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div><h2 id="add-apartment-title" className="text-xl">Add an apartment</h2><p className="mt-1 text-sm text-ink-soft">Search by name or address near UT Austin. No chat needed.</p></div>
        <button type="button" disabled={!!saving} onClick={onClose} aria-label="Close apartment search" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sage disabled:opacity-50"><Close size={18} /></button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (debounce.current) clearTimeout(debounce.current); void search(query.trim()); }} className="px-5 pt-5">
        <label htmlFor="apartment-query" className="mb-2 block text-sm font-semibold">Apartment name or address</label>
        <div className="flex gap-2"><input autoFocus id="apartment-query" value={query} disabled={!!saving} autoComplete="off" aria-describedby="apartment-search-hint" onChange={(event) => {
          controller.current?.abort();
          setQuery(event.target.value);
          setResults([]); setSearchedQuery(null); setNextStart(null); setError(""); setLoading(false);
        }} maxLength={200} placeholder="e.g. The Standard at Austin" className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-clay" /><button disabled={!query.trim() || loading || !!saving} className="rounded-md bg-clay px-4 text-sm font-semibold text-white hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Searching…" : "Search"}</button></div>
      <p id="apartment-search-hint" className="mt-2 text-xs text-ink-soft">Type at least 2 characters to see possible matches from SerpAPI.</p>
      </form>

      {error && <p role="alert" className="mx-5 mt-4 rounded-md bg-clay-tint p-3 text-sm text-clay-dark">{error} {error.startsWith("Sign in") && <Link href="/" className="font-semibold underline">Go to sign in</Link>}</p>}
      <div aria-live="polite" aria-busy={loading} className="px-5 py-4">
        {searchedQuery === null && !loading && <p className="py-4 text-sm leading-relaxed text-ink-soft">Find a property you already have in mind and add it directly to your comparison. Your apartment appears immediately while we research its floor plans, pricing, fees, reviews, and commute. Undisclosed details stay unknown.</p>}
        {loading && <p role="status" className="py-3 text-sm text-ink-soft">Searching apartment listings…</p>}
        {searchedQuery !== null && !results.length && !loading && <p className="py-4 text-sm text-ink-soft">No apartments found for “{searchedQuery}”. Try the full property name or a nearby street.</p>}
        {!!results.length && <p className="mb-2 text-xs text-ink-soft">Results for “{searchedQuery}”</p>}
        <ul className="divide-y divide-line">{results.map((candidate) => {
          const added = shortlistIds.has(candidate.placeId);
          return <li key={candidate.placeId} className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><h3 className="text-sm font-semibold">{candidate.name}</h3><p className="mt-1 text-xs leading-relaxed text-ink-soft">{candidate.address ?? "Address unavailable"}</p>{candidate.googleRating !== null && <p className="mt-1 text-xs text-ink-soft">Google {candidate.googleRating.toFixed(1)} / 5{candidate.googleReviewCount !== null && ` · ${candidate.googleReviewCount} reviews`}</p>}</div><button type="button" disabled={added || !!saving || loading} onClick={() => add(candidate)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-md bg-clay px-3 text-xs font-semibold text-white hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-50">{!added && saving !== candidate.placeId && <Plus size={15} />}{added ? "Added" : saving === candidate.placeId ? "Adding…" : "Add"}</button></li>;
        })}</ul>
        {nextStart !== null && <button type="button" disabled={loading || !!saving} onClick={() => search(searchedQuery ?? query.trim(), nextStart)} className="mt-3 min-h-10 w-full rounded-md border border-line text-sm hover:bg-sage disabled:opacity-50">More results</button>}
      </div>
    </dialog>
  );
}
