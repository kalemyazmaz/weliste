import { getDb } from "@/lib/db";
import { requireMember, route } from "@/lib/http";
import { deleteGalleryPhoto } from "@/lib/business-profile";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_profile");
    await deleteGalleryPhoto(db, tenantId, id, userId);
    return Response.json({ ok: true });
  });
}
