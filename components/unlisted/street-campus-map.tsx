"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { UT_TOWER, type CampusJourney } from "@/lib/campus";

export default function StreetCampusMap({ journeys, activeId, onSelect }: { journeys: CampusJourney[]; activeId: string | null; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<maplibregl.Map | null>(null);
  const select = useRef(onSelect);
  const fitted = useRef("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!ref.current) return;
    let map: maplibregl.Map;
    try {
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
      map = new maplibregl.Map({ container: ref.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [-97.741, 30.286], zoom: 14.5, scrollZoom: true, dragPan: true, touchZoomRotate: true, pitchWithRotate: false, dragRotate: false, attributionControl: { compact: true } });
    } catch { setTimeout(() => setFailed(true), 0); return; }
    instance.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("unlisted-tower", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [UT_TOWER.lng, UT_TOWER.lat] } } });
      map.addLayer({ id: "unlisted-tower-pin", type: "circle", source: "unlisted-tower", paint: { "circle-radius": 8, "circle-color": "#1a73e8", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
      map.addLayer({ id: "unlisted-tower-label", type: "symbol", source: "unlisted-tower", layout: { "text-field": "UT Tower", "text-font": ["Noto Sans Regular"], "text-size": 14, "text-offset": [0, 1.5] }, paint: { "text-color": "#174ea6", "text-halo-color": "#fff", "text-halo-width": 2 } });
      map.addSource("unlisted-apartments", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      map.addLayer({ id: "unlisted-apartment-dots", type: "circle", source: "unlisted-apartments", filter: ["==", "$type", "Point"], paint: { "circle-radius": ["case", ["get", "active"], 14, 11], "circle-color": ["case", ["get", "active"], "#b54a25", "#1f352e"], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
      map.addLayer({ id: "unlisted-apartment-numbers", type: "symbol", source: "unlisted-apartments", filter: ["==", "$type", "Point"], layout: { "text-field": ["get", "number"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": "#fff" } });
      map.on("click", "unlisted-apartment-dots", (event) => { const id = event.features?.[0]?.properties?.id; if (typeof id === "string") select.current(id); });
      map.on("mouseenter", "unlisted-apartment-dots", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "unlisted-apartment-dots", () => { map.getCanvas().style.cursor = ""; });
      setReady(true);
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(ref.current);
    return () => { resize.disconnect(); map.remove(); instance.current = null; };
  }, []);
  useEffect(() => {
    const map = instance.current;
    if (!ready || !map) return;
    const features: Feature<Geometry>[] = journeys.flatMap((journey, index) => {
      const point: Feature<Geometry> = { type: "Feature", properties: { id: journey.placeId, number: String(index + 1), active: journey.placeId === activeId }, geometry: { type: "Point", coordinates: [journey.coords.lng, journey.coords.lat] } };
      return [point];
    });
    const data: FeatureCollection = { type: "FeatureCollection", features };
    (map.getSource("unlisted-apartments") as GeoJSONSource).setData(data);
    const signature = JSON.stringify(journeys.map((journey) => [journey.placeId, journey.coords]));
    if (signature !== fitted.current) {
      fitted.current = signature;
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([UT_TOWER.lng - 0.004, UT_TOWER.lat - 0.004]);
      bounds.extend([UT_TOWER.lng + 0.004, UT_TOWER.lat + 0.004]);
      journeys.forEach((journey) => bounds.extend([journey.coords.lng, journey.coords.lat]));
      // Include the surrounding West Campus streets even on an empty dashboard.
      bounds.extend([-97.749, 30.286]);
      map.fitBounds(bounds, { padding: 36, maxZoom: 15.5, duration: 0 });
    }
  }, [journeys, activeId, ready]);
  return <div className="relative"><div ref={ref} className="relative z-0 h-[520px] w-full bg-stone-100 sm:h-[580px]" aria-label="Interactive street map showing apartments and the UT Tower" />{failed && <p role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm">The interactive map requires WebGL. Try another browser or enable hardware acceleration.</p>}<span className="pointer-events-none absolute bottom-8 left-3 z-10 rounded-md bg-white/95 px-3 py-2 text-xs text-ink-soft">Drag to pan · Scroll or pinch to zoom</span></div>;
}
