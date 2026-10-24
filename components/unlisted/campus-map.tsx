import type { ComparisonApartment } from "./types";

const UT_TOWER = { lat: 30.2862, lng: -97.7394 };
const BOUNDS = { north: 30.2945, south: 30.2835, west: -97.7525, east: -97.7365 };
const WIDTH = 640;
const HEIGHT = 420;

function project({ lat, lng }: { lat: number; lng: number }) {
  return {
    x: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * WIDTH,
    y: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * HEIGHT,
  };
}

type CampusMapProps = {
  apartments: ComparisonApartment[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

/** Schematic of West Campus: straight-line positions relative to the UT Tower, not a street map. */
export function CampusMap({ apartments, activeId, onSelect }: CampusMapProps) {
  const tower = project(UT_TOWER);
  const placed = apartments.filter((apartment) => apartment.coords);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Schematic map of shortlisted apartments and the UT Tower">
          <rect width={WIDTH} height={HEIGHT} fill="var(--color-sage)" />
          {[60, 140, 220, 300, 380].map((y) => (
            <line key={`h${y}`} x1="0" x2={WIDTH} y1={y} y2={y} stroke="#fff" strokeWidth="6" opacity="0.7" />
          ))}
          {[80, 180, 280, 380, 480, 580].map((x) => (
            <line key={`v${x}`} y1="0" y2={HEIGHT} x1={x} x2={x} stroke="#fff" strokeWidth="6" opacity="0.7" />
          ))}
          <rect x={tower.x - 70} y={tower.y - 60} width="160" height="140" rx="8" fill="#d5dec7" />
          <text x={tower.x + 10} y={tower.y + 64} textAnchor="middle" fontSize="13" fill="var(--color-ink-soft)">
            UT campus
          </text>
          {placed.map((apartment) => {
            const point = project(apartment.coords!);
            return (
              <line key={`l-${apartment.id}`} x1={point.x} y1={point.y} x2={tower.x} y2={tower.y} stroke="var(--color-ink)" strokeDasharray="4 5" opacity="0.35" />
            );
          })}
          <g transform={`translate(${tower.x} ${tower.y})`}>
            <rect x="-7" y="-22" width="14" height="30" fill="var(--color-ink)" />
            <path d="M-7 -22 L0 -32 L7 -22 Z" fill="var(--color-ink)" />
            <text y="26" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--color-ink)">
              UT Tower
            </text>
          </g>
          {placed.map((apartment, index) => {
            const point = project(apartment.coords!);
            const active = apartment.id === activeId;
            return (
              <g
                key={apartment.id}
                transform={`translate(${point.x} ${point.y})`}
                onClick={() => onSelect(apartment.id)}
                className="cursor-pointer"
              >
                <circle r={active ? 17 : 14} fill={active ? "var(--color-clay)" : "var(--color-ink)"} stroke="#fff" strokeWidth="3" />
                <text y="5" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">
                  {index + 1}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="border-t border-line px-4 py-2 text-xs text-ink-soft">Schematic positions from sample coordinates. Times are walking routes to the UT Tower.</p>
      </div>

      <ol className="flex flex-col gap-2">
        {placed.map((apartment, index) => {
          const active = apartment.id === activeId;
          return (
            <li key={apartment.id}>
              <button
                type="button"
                onClick={() => onSelect(apartment.id)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm ${
                  active ? "border-clay bg-clay-tint/60" : "border-line bg-paper-raised hover:border-ink/30"
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${active ? "bg-clay" : "bg-ink"}`}>
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{apartment.name}</span>
                  <span className="text-ink-soft">
                    {apartment.walking?.formattedDuration ?? "—"} walk · {apartment.cycling?.formattedDuration ?? "—"} bike
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
