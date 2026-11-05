import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { addDeliveryPhoto } from "@/lib/delivery";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    const photoId = await addDeliveryPhoto(db, tenantId, id, await readJson(req), userId);
    return Response.json({ ok: true, id: photoId }, { status: 201 });
  });
}
