import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { deleteOrgCost, setOrgCostPaid } from "@/lib/org";

type Ctx = { params: Promise<{ tenantId: string; costId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, costId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "view_ledger");
    const body = (await readJson(req)) as { paid?: unknown } | null;
    await setOrgCostPaid(db, tenantId, costId, body?.paid, userId);
    return Response.json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, costId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "view_ledger");
    await deleteOrgCost(db, tenantId, costId, userId);
    return Response.json({ ok: true });
  });
}
