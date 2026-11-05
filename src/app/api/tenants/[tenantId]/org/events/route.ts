import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { listOrgEvents, saveOrgEvent } from "@/lib/org";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    return Response.json({ items: await listOrgEvents(db, tenantId) });
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    const id = await saveOrgEvent(db, tenantId, null, await readJson(req), userId);
    return Response.json({ ok: true, id }, { status: 201 });
  });
}
