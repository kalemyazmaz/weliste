import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { saveModules } from "@/lib/modules";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string }> };

// Özellik aç/kapa (yalnızca sahip): { "stats": false, ... }.
export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_profile");
    return Response.json({ ok: true, modules: await saveModules(db, tenantId, await readJson(req), userId) });
  });
}
