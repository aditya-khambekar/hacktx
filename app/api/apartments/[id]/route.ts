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
import { prisma } from "@/lib/db";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apartmentJson({ error: "unauthorized" }, 401);

    const { id } = await params;
    const deleted = await prisma.apartment.deleteMany({
      where: { id, userId: session.user.id },
    });
    // #region agent log
    fetch('http://127.0.0.1:7918/ingest/7f2113e6-8bdc-48b8-8acb-df123eb968a0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cb30fc'},body:JSON.stringify({sessionId:'cb30fc',runId:'post-fix',hypothesisId:'H1',location:'api/apartments/[id]/route.ts:DELETE',message:'delete saved apartment',data:{id,deletedCount:deleted.count},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return deleted.count > 0
      ? apartmentJson({ ok: true })
      : apartmentJson({ error: "not_found" }, 404);
  } catch (error) {
    return apartmentServerError(error, "delete");
  }
}
