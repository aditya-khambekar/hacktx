import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apartmentJson } from "@/lib/apartments";
import { getMapsPlace, serpSearch, withSerpBudget } from "@/lib/serpapi";

type Photo = { url: string; thumbnail: string; attribution: string; sourceUrl: string };
const cache = new Map<string, { photos: Photo[]; expires: number }>();
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function imageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith(".googleusercontent.com") || url.hostname.endsWith(".ggpht.com") || url.hostname.endsWith(".gstatic.com")) ? url.toString() : null;
  } catch { return null; }
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);
    const { id } = await params;
    const saved = await prisma.apartment.findFirst({ where: { id, userId: session.user.id }, select: { placeId: true } });
    if (!saved) return apartmentJson({ error: "not_found" }, 404);
    const cached = cache.get(saved.placeId);
    if (cached && cached.expires > Date.now()) return apartmentJson({ photos: cached.photos });
    if (!process.env.SERPAPI_KEY) return apartmentJson({ error: "photos_unavailable" }, 503);
    const photos = await withSerpBudget(async () => {
      const place = await getMapsPlace(saved.placeId);
      if (!place || "error" in place) return [];
      const sourceUrl = `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(saved.placeId)}`;
      const dataId = place.data_id;
      let rows: unknown[] = [];
      if (typeof dataId === "string") {
        try {
          const payload = record(await serpSearch({ engine: "google_maps_photos", data_id: dataId, hl: "en" }));
          rows = Array.isArray(payload.photos) ? payload.photos : [];
        } catch { /* The place thumbnail can still be available. */ }
      }
      const result: Photo[] = [];
      for (const raw of rows) {
        const row = record(raw);
        const url = imageUrl(row.image) ?? imageUrl(row.thumbnail);
        if (url && !result.some((photo) => photo.url === url)) result.push({ url, thumbnail: imageUrl(row.thumbnail) ?? url, attribution: typeof record(row.user).name === "string" ? `Google Maps · ${record(row.user).name}` : "Google Maps listing photo", sourceUrl });
        if (result.length === 8) break;
      }
      const thumbnail = imageUrl(place.thumbnail);
      if (!result.length && thumbnail) result.push({ url: thumbnail, thumbnail, attribution: "Google Maps listing photo", sourceUrl });
      return result;
    });
    if (photos.length) {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(saved.placeId, { photos, expires: Date.now() + 24 * 60 * 60 * 1000 });
    }
    return apartmentJson({ photos });
  } catch { return apartmentJson({ error: "photos_unavailable" }, 502); }
}
