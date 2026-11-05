import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { requireMember, route } from "@/lib/http";
import { revokeVenueShareLink } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_catalog");
    await revokeVenueShareLink(db, tenantId, id, userId);
    return Response.json({ ok: true });
  });
}
