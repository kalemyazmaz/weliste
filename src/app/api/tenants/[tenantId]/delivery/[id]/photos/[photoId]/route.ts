import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { requireMember, route } from "@/lib/http";
import { deleteDeliveryPhoto } from "@/lib/delivery";

type Ctx = { params: Promise<{ tenantId: string; id: string; photoId: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, photoId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    await deleteDeliveryPhoto(db, tenantId, photoId, userId);
    return Response.json({ ok: true });
  });
}
