import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  apartmentFields,
  apartmentJson,
  apartmentServerError,
  apartmentTransaction,
  isRecord,
  profileData,
  readProfile,
} from "@/lib/apartments";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);

    const apartments = await prisma.apartment.findMany({
      where: { userId: session.user.id },
      select: apartmentFields,
      orderBy: { updatedAt: "desc" },
    });
    return apartmentJson(apartments);
  } catch (error) {
    return apartmentServerError(error, "list");
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);

    const body: unknown = await request.json().catch(() => null);
    const profile = isRecord(body) ? readProfile(body.profile) : null;
    if (!profile) return apartmentJson({ error: "invalid_profile" }, 400);

    const userId = session.user.id;
    const where = { userId_placeId: { userId, placeId: profile.placeId } };
    const apartment = await apartmentTransaction(async (tx) => {
      const existing = await tx.apartment.findUnique({ where, select: { labels: true } });
      // Adding the same suggestion again must not erase the user's labels.
      const data = profileData({ ...profile, labels: existing?.labels ?? profile.labels });
      return tx.apartment.upsert({
        where,
        create: { userId, placeId: profile.placeId, ...data },
        update: data,
        select: apartmentFields,
      });
    });
    return apartmentJson(apartment);
  } catch (error) {
    return apartmentServerError(error, "save");
  }
}
