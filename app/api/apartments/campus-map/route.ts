import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UT_TOWER, type CampusJourney } from "@/lib/campus";
import { getMapsPlace, travelTimeBetween, withSerpBudget } from "@/lib/serpapi";
import { apartmentJson } from "@/lib/apartments";

const cache = new Map<string, { expires: number; data: CampusJourney }>();
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.placeId !== "string" || !body.placeId.trim() || body.placeId.length > 256) return apartmentJson({ error: "invalid_request" }, 400);
    const apartment = await prisma.apartment.findUnique({ where: { userId_placeId: { userId: session.user.id, placeId: body.placeId } }, select: { placeId: true } });
    if (!apartment) return apartmentJson({ error: "not_saved" }, 404);
    const locationOnly = body.locationOnly === true;
    const key = `${body.placeId}:${locationOnly ? "location" : "tower"}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return apartmentJson(cached.data);
    if (!process.env.SERPAPI_KEY) return apartmentJson({ error: "search_unavailable" }, 503);
    const data = await withSerpBudget(async () => {
      const place = await getMapsPlace(body.placeId);
      if (!place || "error" in place) throw new Error("location_unavailable");
      const coordinates = place.gps_coordinates as { latitude?: number; longitude?: number } | undefined;
      const lat = coordinates?.latitude;
      const lng = coordinates?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("location_unavailable");
      const destination = UT_TOWER;
      const legs = locationOnly ? [] : await Promise.allSettled([
        travelTimeBetween(`${lat},${lng}`, `${destination.lat},${destination.lng}`, "walking"),
        travelTimeBetween(`${lat},${lng}`, `${destination.lat},${destination.lng}`, "cycling"),
      ]);
      const leg = (result: typeof legs[number] | undefined) => result?.status === "fulfilled" && result.value && !("error" in result.value) ? { formatted_duration: result.value.formatted_duration, formatted_distance: result.value.formatted_distance } : null;
      return { placeId: body.placeId, coords: { lat, lng }, destination, walking: leg(legs[0]), cycling: leg(legs[1]), checkedAt: new Date().toISOString() } satisfies CampusJourney;
    });
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    if (locationOnly || (data.walking && data.cycling)) cache.set(key, { data, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return apartmentJson(data);
  } catch { return apartmentJson({ error: "campus_routes_unavailable" }, 502); }
}
