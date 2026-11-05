import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { setOrgEventStaff } from "@/lib/org";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    const body = (await readJson(req)) as { staffIds?: unknown } | null;
    await setOrgEventStaff(db, tenantId, id, body?.staffIds, userId);
    return Response.json({ ok: true });
  });
}
