import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { addProduct, listProducts } from "@/lib/products";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    return Response.json({ items: await listProducts(db, tenantId) });
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_catalog");
    await addProduct(db, tenantId, await readJson(req), userId);
    return Response.json({ ok: true }, { status: 201 });
  });
}
