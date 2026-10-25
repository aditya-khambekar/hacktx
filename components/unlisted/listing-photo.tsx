"use client";
import { useEffect, useState } from "react";
import { photoSources } from "./photo-sources";
import { Bed } from "./icons";
import type { ComparisonApartment } from "./types";

type Photo = { url: string; thumbnail: string; attribution: string; sourceUrl: string };
const cached = new Map<string, Photo[]>();
const pending = new Map<string, Promise<Photo[]>>();
function loadPhotos(databaseId: string) {
  const existing = cached.get(databaseId);
  if (existing) return Promise.resolve(existing);
  const loading = pending.get(databaseId);
  if (loading) return loading;
  const task = fetch(`/api/apartments/${encodeURIComponent(databaseId)}/photos`).then(async (response) => {
    if (!response.ok) throw new Error("Photos unavailable");
    const data = await response.json();
    const photos: Photo[] = data.photos;
    if (photos.length) cached.set(databaseId, photos);
    return photos;
  }).finally(() => pending.delete(databaseId));
  pending.set(databaseId, task);
  return task;
}

export function ListingPhoto({ name, databaseId, gallery = false }: { tone?: ComparisonApartment["photoTone"]; name: string; databaseId?: string; gallery?: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(!!databaseId);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    if (!databaseId) return;
    loadPhotos(databaseId).then((result) => { if (active) setPhotos(result); }).catch(() => { /* Render the honest unavailable state. */ }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [databaseId]);
  const available = photos.filter((photo) => photoSources(photo, gallery).some((source) => !failedSources.includes(source)));
  const photo = available[Math.min(selected, Math.max(0, available.length - 1))];
  const source = photo ? photoSources(photo, gallery).find((url) => !failedSources.includes(url)) : undefined;
  return <div className="relative block h-full w-full overflow-hidden bg-stone-100">
    {photo ? <>
      {/* Provider-hosted photos retain their original source; no generic substitutes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={source} src={source} alt={`${name} · listing photo ${selected + 1}`} className="absolute inset-0 block h-full w-full object-cover object-center" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => { if (source) setFailedSources((current) => [...current, source]); }} />
      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="absolute bottom-2 left-2 max-w-[85%] rounded bg-white/95 px-2 py-1 text-[10px] text-ink underline underline-offset-2">{photo.attribution}</a>
      {gallery && available.length > 1 && <div className="absolute top-3 left-3 flex max-w-[85%] flex-wrap gap-1.5">{available.map((item, index) => <button key={item.url} type="button" onClick={() => setSelected(index)} aria-pressed={index === selected} aria-label={`Show photo ${index + 1}`} className={`grid size-9 place-items-center rounded-md text-xs font-semibold ${index === selected ? "bg-ink text-white" : "bg-white text-ink"}`}>{index + 1}</button>)}</div>}
    </> : <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-ink-soft"><Bed size={28} /><span>{loading ? "Loading listing photos…" : "Photo unavailable"}</span><span className="text-xs">{name}</span></div>}
  </div>;
}
