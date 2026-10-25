"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CampusJourney } from "@/lib/campus";
import type { ComparisonApartment } from "./types";

const StreetMap = dynamic(() => import("./street-campus-map"), { ssr: false });
const selectApartment = () => {};

export function ApartmentLocationMap({ apartment }: { apartment: ComparisonApartment }) {
  const [journey, setJourney] = useState<CampusJourney | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    if (!apartment.databaseId) return;
    async function load() {
      setJourney(null);
      setError(null);
      try {
        const response = await fetch("/api/apartments/campus-map", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId: apartment.id, locationOnly: true }), signal: request.signal,
        });
        if (!response.ok) throw new Error("The location map couldn’t load. You can still open the apartment in Google Maps.");
        const data: CampusJourney = await response.json();
        if (!request.signal.aborted) setJourney(data);
      } catch (failure) {
        if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : "Map unavailable.");
      }
    }
    void load();
    return () => request.abort();
  }, [apartment.id, apartment.databaseId, attempt]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apartment.name)}&query_place_id=${encodeURIComponent(apartment.id)}`;
  return <section aria-labelledby="apartment-location-heading" className="overflow-hidden rounded-xl border border-line bg-paper-raised">
    <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
      <div><h2 id="apartment-location-heading" className="text-xl font-semibold">Location</h2><p className="mt-1 text-sm text-ink-soft">{apartment.street}</p></div>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="min-h-9 text-sm font-medium text-clay-dark underline underline-offset-4">Open in Google Maps</a>
    </div>
    {journey ? <StreetMap journeys={[journey]} activeId={apartment.id} onSelect={selectApartment} showTower={false} compact /> : <div className="grid min-h-64 place-items-center bg-paper p-6 text-center text-sm text-ink-soft">
      {error ? <div><p role="alert">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 min-h-10 rounded-md border border-line px-4 font-medium text-ink">Retry map</button></div> : <p role="status">{apartment.databaseId ? "Loading apartment location…" : "The map will appear when the apartment is saved."}</p>}
    </div>}
  </section>;
}
