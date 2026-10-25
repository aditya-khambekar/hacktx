export const UT_TOWER = { id: "tower", name: "UT Tower", lat: 30.2862, lng: -97.7394 } as const;

export type CampusJourney = {
  placeId: string;
  coords: { lat: number; lng: number };
  destination: { id: string; name: string; lat: number; lng: number };
  walking: { formatted_duration: string; formatted_distance: string } | null;
  cycling: { formatted_duration: string; formatted_distance: string } | null;
  checkedAt: string;
};
