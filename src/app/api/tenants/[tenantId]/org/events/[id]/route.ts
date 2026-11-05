import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { deleteOrgEvent, getOrgEvent, saveOrgEvent } from "@/lib/org";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { role } = await requireMember(db, req, tenantId);
    const detail = await getOrgEvent(db, tenantId, id);
    // Bütçe yalnızca sahip görür.
    return Response.json(role === "owner" ? detail : { ...detail, costs: [] });
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    await saveOrgEvent(db, tenantId, id, await readJson(req), userId);
    return Response.json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    await deleteOrgEvent(db, tenantId, id, userId);
    return Response.json({ ok: true });
  });
}
