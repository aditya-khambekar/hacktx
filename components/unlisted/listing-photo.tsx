import type { ComparisonApartment } from "./types";

const TONES: Record<ComparisonApartment["photoTone"], { sky: string; wall: string; trim: string; tree: string }> = {
  stucco: { sky: "#dfe6dc", wall: "#efe6d6", trim: "#5d6b5f", tree: "#4f6b45" },
  brick: { sky: "#e3e4da", wall: "#b86a4b", trim: "#3d3a35", tree: "#566f43" },
  timber: { sky: "#e6e3d4", wall: "#9b7350", trim: "#4a3a2b", tree: "#46613d" },
};

/** Placeholder facade drawn in code until listing photos come from the backend. */
export function ListingPhoto({ tone, name }: { tone: ComparisonApartment["photoTone"]; name: string }) {
  const c = TONES[tone];
  const windows = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      windows.push(<rect key={`${row}-${col}`} x={92 + col * 38} y={42 + row * 30} width="20" height="18" rx="1.5" fill={c.trim} opacity="0.75" />);
    }
  }
  return (
    <svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={`Illustration standing in for a photo of ${name}`}>
      <rect width="360" height="180" fill={c.sky} />
      <rect x="78" y="28" width="204" height="152" fill={c.wall} />
      <rect x="72" y="22" width="216" height="10" fill={c.trim} />
      {windows}
      <rect x="164" y="150" width="32" height="30" fill={c.trim} />
      <circle cx="40" cy="120" r="44" fill={c.tree} />
      <circle cx="330" cy="128" r="40" fill={c.tree} opacity="0.9" />
      <rect x="36" y="140" width="8" height="40" fill={c.trim} />
      <rect x="326" y="150" width="8" height="30" fill={c.trim} />
      <rect y="172" width="360" height="8" fill="#c9c4b4" />
    </svg>
  );
}
