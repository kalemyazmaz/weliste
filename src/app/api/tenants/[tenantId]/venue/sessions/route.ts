import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { createVenueSession, listVenueSessions } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    const sp = new URL(req.url).searchParams;
    return Response.json({ items: await listVenueSessions(db, tenantId, sp.get("from") ?? "", sp.get("to") ?? "", sp.get("hallId")) });
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    const id = await createVenueSession(db, tenantId, await readJson(req), userId);
    return Response.json({ ok: true, id }, { status: 201 });
  });
}
