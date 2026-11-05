import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { deleteBridalFile, saveBridalFile } from "@/lib/bridal";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    await saveBridalFile(db, tenantId, id, await readJson(req), userId);
    return Response.json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    await deleteBridalFile(db, tenantId, id, userId);
    return Response.json({ ok: true });
  });
}
