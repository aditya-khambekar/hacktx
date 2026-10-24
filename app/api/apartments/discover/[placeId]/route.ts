import { auth } from "@/lib/auth";
import { apartmentJson } from "@/lib/apartments";
import { buildDiscoveredProfile, discoveryFailure } from "@/lib/discovery";
import { withSerpBudget } from "@/lib/serpapi";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);
    const { placeId } = await params;
    if (!/^[a-zA-Z0-9_-]{1,256}$/.test(placeId)) {
      return apartmentJson({ error: "invalid_place_id" }, 400);
    }
    if (!process.env.SERPAPI_KEY || !process.env.MODEL_API_KEY) {
      return apartmentJson({ error: "profile_unavailable" }, 503);
    }
    try {
      return apartmentJson(await withSerpBudget(() => buildDiscoveredProfile(placeId)));
    } catch (error) {
      return discoveryFailure(error, "profile_failed");
    }
  } catch (error) {
    return discoveryFailure(error, "internal_error", 500);
  }
}
