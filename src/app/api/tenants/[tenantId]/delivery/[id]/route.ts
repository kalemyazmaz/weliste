import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { deleteDeliverySession, getDeliverySession, updateDeliverySession } from "@/lib/delivery";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    return Response.json(await getDeliverySession(db, tenantId, id));
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    await updateDeliverySession(db, tenantId, id, await readJson(req), userId);
    return Response.json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    await deleteDeliverySession(db, tenantId, id, userId);
    return Response.json({ ok: true });
  });
}
