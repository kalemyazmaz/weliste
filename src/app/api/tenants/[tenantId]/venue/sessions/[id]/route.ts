import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { updateVenueSession } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

// Seans güncelleme: kişi, fiyat, kapora, not ve iptal / yeniden etkinleştirme.
export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    await updateVenueSession(db, tenantId, id, await readJson(req), userId);
    return Response.json({ ok: true });
  });
}
