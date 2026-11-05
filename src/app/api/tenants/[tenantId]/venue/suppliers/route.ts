import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { listVenueSuppliers, saveVenueSupplier } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    return Response.json({ items: await listVenueSuppliers(db, tenantId) });
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_catalog");
    await saveVenueSupplier(db, tenantId, null, await readJson(req), userId);
    return Response.json({ ok: true }, { status: 201 });
  });
}
