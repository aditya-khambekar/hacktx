"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { UT_TOWER, type CampusJourney } from "@/lib/campus";
import type { ComparisonApartment } from "./types";
const StreetMap = dynamic(() => import("./street-campus-map"), { ssr: false, loading: () => <div className="grid h-[440px] place-items-center bg-sage text-sm">Loading street map…</div> });

type Props = { apartments: ComparisonApartment[]; activeId: string | null; onSelect: (id: string) => void };
export function CampusMap({ apartments, activeId, onSelect }: Props) {
  const [journeys, setJourneys] = useState<CampusJourney[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const ids = JSON.stringify(apartments.filter((apartment) => apartment.databaseId).map((apartment) => apartment.id));
  useEffect(() => {
    const request = new AbortController();
    const load = async () => {
      setLoading(true);
      setJourneys([]);
      setErrors({});
      const placeIds: string[] = JSON.parse(ids);
      const results = await Promise.all(placeIds.map(async (placeId) => {
        try {
          const response = await fetch("/api/apartments/campus-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId }), signal: request.signal });
          if (!response.ok) throw new Error(response.status === 401 ? "Sign in to load Google Maps distances." : "Location or route unavailable. Try again.");
          return { placeId, data: await response.json() as CampusJourney };
        } catch (failure) { return { placeId, error: failure instanceof Error ? failure.message : "Map data unavailable." }; }
      }));
      if (request.signal.aborted) return;
      setJourneys(results.flatMap((result) => result.data ? [result.data] : []));
      setErrors(Object.fromEntries(results.flatMap((result) => result.error ? [[result.placeId, result.error]] : [])));
      setLoading(false);
    };
    void load();
    return () => request.abort();
  }, [ids, retry]);
  const selectedJourney = journeys.find((journey) => journey.placeId === activeId) ?? journeys[0];
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const embedParams = new URLSearchParams({ key: googleKey ?? "", maptype: "roadmap", language: "en" });
  if (selectedJourney) {
    embedParams.set("origin", `${selectedJourney.coords.lat},${selectedJourney.coords.lng}`);
    embedParams.set("destination", `${UT_TOWER.lat},${UT_TOWER.lng}`);
    embedParams.set("mode", "walking");
    embedParams.set("units", "imperial");
  } else {
    embedParams.set("q", "UT Tower, Austin, TX");
    embedParams.set("zoom", "15");
  }
  const names = new Map(apartments.map((apartment) => [apartment.id, apartment.name]));
  return <section aria-label="Apartments and campus map" className="space-y-4">
    <div><h3 className="text-lg font-semibold">Walking to the UT Tower</h3><p className="mt-1 text-xs text-ink-soft">Walking and biking distances from Google Maps via SerpAPI. Select an apartment to see its route.</p></div>
    {!apartments.length && <p className="text-sm text-ink-soft">Explore campus and the surrounding streets. Apartments appear here when you add them.</p>}
    {loading && <p role="status" className="text-sm text-ink-soft">Loading apartment locations and routes…</p>}
    <div className={`grid gap-4 ${apartments.length ? "xl:grid-cols-[minmax(0,1fr)_16rem]" : ""}`}>
      <div className="min-w-0 overflow-hidden rounded-xl border border-line">{googleKey ? <iframe title={selectedJourney ? `Google Maps walking route to the UT Tower` : "Google Maps around the UT Tower"} src={`https://www.google.com/maps/embed/v1/${selectedJourney ? "directions" : "place"}?${embedParams}`} className="h-[520px] w-full border-0 sm:h-[580px]" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <><StreetMap journeys={journeys} activeId={activeId} onSelect={onSelect} /></>}</div>
      {!!apartments.length && <ol className="space-y-3">{apartments.map((apartment) => {
        const journey = journeys.find((item) => item.placeId === apartment.id);
        const number = journeys.findIndex((item) => item.placeId === apartment.id) + 1;
        const mapsLink = journey ? `https://www.google.com/maps/dir/?api=1&origin=${journey.coords.lat},${journey.coords.lng}&destination=${UT_TOWER.lat},${UT_TOWER.lng}&travelmode=walking` : null;
        return <li key={apartment.id} className={`rounded-lg border p-3 ${activeId === apartment.id ? "border-clay bg-clay-tint" : "border-line bg-paper-raised"}`}><button type="button" onClick={() => onSelect(apartment.id)} aria-pressed={activeId === apartment.id} className="w-full text-left text-sm font-semibold">{number > 0 ? `${number}. ` : ""}{names.get(apartment.id)}</button>{journey ? <><p className="mt-2 text-xs leading-relaxed text-ink-soft">{UT_TOWER.name}</p><p className="mt-2 text-xs">Walk: {journey.walking ? `${journey.walking.formatted_duration} · ${journey.walking.formatted_distance}` : "Unavailable"}</p><p className="mt-1 text-xs">Bike: {journey.cycling ? `${journey.cycling.formatted_duration} · ${journey.cycling.formatted_distance}` : "Unavailable"}</p><a href={mapsLink!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-clay-dark underline underline-offset-4">Open walking route in Google Maps</a></> : <p className="mt-2 text-xs text-ink-soft">{errors[apartment.id] ?? (apartment.databaseId ? "Loading location…" : "Map details appear after research is saved.")}</p>}</li>;
      })}</ol>}
    </div>
    {(!!Object.keys(errors).length || journeys.some((journey) => !journey.walking || !journey.cycling)) && <button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)} className="min-h-10 rounded-md border border-line px-3 text-sm disabled:opacity-50">Retry map data</button>}

  </section>;
}
