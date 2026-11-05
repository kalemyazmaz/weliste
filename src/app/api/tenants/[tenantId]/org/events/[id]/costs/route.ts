import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { addOrgCost } from "@/lib/org";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

// Bütçe giderleri yalnızca sahip tarafından yönetilir.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "view_ledger");
    await addOrgCost(db, tenantId, id, await readJson(req), userId);
    return Response.json({ ok: true }, { status: 201 });
  });
}
