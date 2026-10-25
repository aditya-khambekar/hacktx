import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { researchApartment } from "@/lib/research-cache";
import { withSerpBudget } from "@/lib/serpapi";
import {
  apartmentFields,
  apartmentJson,
  apartmentServerError,
  apartmentTransaction,
  profileData,
} from "@/lib/apartments";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);

    const { id } = await params;
    const where = { id, userId: session.user.id };
    const existing = await prisma.apartment.findFirst({
      where,
      select: { placeId: true },
    });
    if (!existing) return apartmentJson({ error: "not_found" }, 404);

    const profile = await withSerpBudget(() => researchApartment(existing.placeId, true)).catch(() => null);
    if (!profile) return apartmentJson({ error: "refresh_failed" }, 502);

    const apartment = await apartmentTransaction(async (tx) => {
      // Read labels after the API calls so edits made during refresh survive.
      const current = await tx.apartment.findFirst({ where, select: { labels: true } });
      if (!current) return null;
      return tx.apartment.update({
        where,
        data: profileData({ ...profile, labels: current.labels }),
        select: apartmentFields,
      });
    });
    return apartment
      ? apartmentJson(apartment)
      : apartmentJson({ error: "not_found" }, 404);
  } catch (error) {
    return apartmentServerError(error, "refresh");
  }
}
