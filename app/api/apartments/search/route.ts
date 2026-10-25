import { auth } from "@/lib/auth";
import { apartmentJson } from "@/lib/apartments";
import { discoveryFailure, discoverApartments, readSearchInput } from "@/lib/discovery";
import { withSerpBudget } from "@/lib/serpapi";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);
    const input = readSearchInput(await request.json().catch(() => null));
    if (!input) return apartmentJson({ error: "invalid_search" }, 400);
    if (!process.env.SERPAPI_KEY) return apartmentJson({ error: "search_unavailable" }, 503);
    try {
      return apartmentJson(await withSerpBudget(() => discoverApartments(input.query, input.start)));
    } catch (error) {
      return discoveryFailure(error, "search_failed");
    }
  } catch (error) {
    return discoveryFailure(error, "internal_error", 500);
  }
}
