import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { savePlan } from "@/lib/payroll";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string; staffId: string }> };

// Personel maaş ve prim planını kaydeder (yalnızca sahip).
export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, staffId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "view_ledger");
    await savePlan(db, tenantId, staffId, await readJson(req), userId);
    return Response.json({ ok: true });
  });
}
