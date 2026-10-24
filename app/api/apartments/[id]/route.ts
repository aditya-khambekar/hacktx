import { auth } from "@/lib/auth";
import {
  apartmentFields,
  apartmentJson,
  apartmentServerError,
  apartmentTransaction,
  isRecord,
  normalizeLabels,
  readProfile,
} from "@/lib/apartments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);

    const body: unknown = await request.json().catch(() => null);
    if (
      !isRecord(body) ||
      Object.keys(body).some((key) => key !== "addLabels" && key !== "removeLabels")
    ) return apartmentJson({ error: "invalid_labels" }, 400);

    const addLabels = normalizeLabels(body.addLabels === undefined ? [] : body.addLabels);
    const removeLabels = normalizeLabels(body.removeLabels === undefined ? [] : body.removeLabels);
    if (!addLabels || !removeLabels) return apartmentJson({ error: "invalid_labels" }, 400);

    const { id } = await params;
    const where = { id, userId: session.user.id };
    const apartment = await apartmentTransaction(async (tx) => {
      const existing = await tx.apartment.findFirst({
        where,
        select: { labels: true, profile: true },
      });
      if (!existing) return null;
      const profile = readProfile(existing.profile);
      if (!profile) throw new Error("Stored apartment profile is invalid");

      const labels = new Set([...existing.labels, ...addLabels]);
      for (const label of removeLabels) labels.delete(label);
      const nextLabels = [...labels];
      return tx.apartment.update({
        where,
        data: { labels: nextLabels, profile: { ...profile, labels: nextLabels } },
        select: apartmentFields,
      });
    });
    return apartment
      ? apartmentJson(apartment)
      : apartmentJson({ error: "not_found" }, 404);
  } catch (error) {
    return apartmentServerError(error, "labels");
  }
}
